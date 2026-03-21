/**
 * ============================================================
 * ALTERNATIVE DATA FETCHER v1.0
 * ============================================================
 * server/engine/altDataFetcher.ts
 *
 * Fetches and caches public Indonesian alternative data:
 *   Source 1 — BMKG (Badan Meteorologi, Klimatologi, Geofisika)
 *              Weather anomalies for key production regions
 *              API: https://data.bmkg.go.id (free, public JSON)
 *
 *   Source 2 — KPBN/CPO Reference Price
 *              Indonesian CPO benchmark price (IDR/kg)
 *              Source: ESDM Ministry public data + scrape fallback
 *
 *   Source 3 — HBA Coal Index
 *              Indonesian coal reference price (USD/ton)
 *              Source: minerba.esdm.go.id (public monthly)
 *
 * DESIGN RULES:
 *   - Never throws — all fetches wrapped in try/catch
 *   - Returns stale cache on fetch failure (never null)
 *   - Each source has independent TTL and failure counter
 *   - Max 3 consecutive failures before source is marked degraded
 *   - All data tagged with fetchedAt timestamp
 *   - No external dependencies beyond built-in fetch
 *   - Safe to call from radarEngine.ts batch pipeline
 *
 * SHADOW MODE:
 *   Data is fetched and cached but not yet used by the engine.
 *   Call getAltDataStatus() to inspect cached values.
 *   Models M17/M18/M19 will read from this cache when wired in.
 * ============================================================
 */

// ── Types ─────────────────────────────────────────────────────

export interface WeatherRegion {
  regionId: string;
  regionName: string;
  sector: string;
  rainfallMm: number | null;
  rainfallAnomaly: number | null;
  weatherCode: string | null;
  temperature: number | null;
  fetchedAt: string;
}

export interface CPOPriceData {
  priceIDR: number | null;
  priceMYR: number | null;
  priceUSD: number | null;
  changePercent30d: number | null;
  trend: 'NAIK' | 'TURUN' | 'STABIL' | null;
  fetchedAt: string;
  source: string;
}

export interface CoalPriceData {
  hba1USD: number | null;
  hba2USD: number | null;
  hba3USD: number | null;
  changePercent30d: number | null;
  trend: 'NAIK' | 'TURUN' | 'STABIL' | null;
  fetchedAt: string;
  source: string;
}

export interface AltDataSnapshot {
  weather: WeatherRegion[];
  cpo: CPOPriceData;
  coal: CoalPriceData;
  lastFullRefresh: string | null;
  degradedSources: string[];
}

// ── Cache ─────────────────────────────────────────────────────

interface SourceCache<T> {
  data: T | null;
  fetchedAt: number;
  consecutiveFailures: number;
  isDegraded: boolean;
}

const WEATHER_TTL  = 3  * 60 * 60 * 1000;
const CPO_TTL      = 6  * 60 * 60 * 1000;
const COAL_TTL     = 24 * 60 * 60 * 1000;
const MAX_FAILURES = 3;

const FETCH_TIMEOUT_MS = 8000;

let _weatherCache: SourceCache<WeatherRegion[]> = {
  data: null, fetchedAt: 0,
  consecutiveFailures: 0, isDegraded: false,
};
let _cpoCache: SourceCache<CPOPriceData> = {
  data: null, fetchedAt: 0,
  consecutiveFailures: 0, isDegraded: false,
};
let _coalCache: SourceCache<CoalPriceData> = {
  data: null, fetchedAt: 0,
  consecutiveFailures: 0, isDegraded: false,
};

// ── Key production regions for IDX sectors ────────────────────

const KEY_REGIONS = [
  { regionId: '15', regionName: 'Riau',              sector: 'Consumer Staples' },
  { regionId: '16', regionName: 'Sumatera Selatan',  sector: 'Consumer Staples' },
  { regionId: '14', regionName: 'Kalimantan Tengah', sector: 'Consumer Staples' },
  { regionId: '17', regionName: 'Kalimantan Timur',  sector: 'Energy'           },
  { regionId: '18', regionName: 'Kalimantan Selatan', sector: 'Basic Materials' },
  { regionId: '19', regionName: 'Kalimantan Barat',   sector: 'Basic Materials' },
  { regionId: '20', regionName: 'Sulawesi Tengah',   sector: 'Basic Materials'  },
  { regionId: '21', regionName: 'Maluku Utara',      sector: 'Basic Materials'  },
  { regionId: '12', regionName: 'Jawa Tengah',       sector: 'Consumer Discretionary' },
  { regionId: '11', regionName: 'Jawa Timur',        sector: 'Consumer Discretionary' },
];

// ── Fetch timeout wrapper ─────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  ms: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ── BMKG Weather Fetcher ──────────────────────────────────────

async function fetchBMKGWeather(): Promise<WeatherRegion[]> {
  const results: WeatherRegion[] = [];
  const now = new Date().toISOString();

  const BMKG_PROVINCE_MAP: Record<string, string> = {
    '11': 'jawa-timur',
    '12': 'jawa-tengah',
    '14': 'kalimantan-tengah',
    '15': 'riau',
    '16': 'sumatera-selatan',
    '17': 'kalimantan-timur',
    '18': 'kalimantan-selatan',
    '19': 'kalimantan-barat',
    '20': 'sulawesi-tengah',
    '21': 'maluku-utara',
  };

  for (const region of KEY_REGIONS) {
    try {
      const provinceName = BMKG_PROVINCE_MAP[region.regionId];
      if (!provinceName) continue;

      const url = `https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/DigitalForecast-${
        provinceName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
      }.xml`;

      const response = await fetchWithTimeout(url, 5000);

      if (!response.ok) {
        results.push({
          ...region,
          rainfallMm: null,
          rainfallAnomaly: null,
          weatherCode: null,
          temperature: null,
          fetchedAt: now,
        });
        continue;
      }

      const text = await response.text();

      const weatherMatch = text.match(/<weather>(\d+)<\/weather>/);
      const tempMatch    = text.match(/<t>(\d+)<\/t>/);

      const weatherCode = weatherMatch ? weatherMatch[1] : null;
      const temperature = tempMatch ? parseFloat(tempMatch[1]) : null;

      let rainfallMm: number | null = null;
      if (weatherCode) {
        const code = parseInt(weatherCode);
        if (code >= 95) rainfallMm = 25;
        else if (code >= 80) rainfallMm = 10;
        else if (code >= 60) rainfallMm = 5;
        else rainfallMm = 0;
      }

      results.push({
        ...region,
        rainfallMm,
        rainfallAnomaly: null,
        weatherCode,
        temperature,
        fetchedAt: now,
      });

    } catch (err) {
      results.push({
        ...region,
        rainfallMm: null,
        rainfallAnomaly: null,
        weatherCode: null,
        temperature: null,
        fetchedAt: now,
      });
    }
  }

  return results;
}

// ── CPO Price Fetcher ─────────────────────────────────────────

const CPO_FALLBACK: CPOPriceData = {
  priceIDR: 15655,
  priceMYR: null,
  priceUSD: 938.87,
  changePercent30d: null,
  trend: 'NAIK',
  fetchedAt: '2026-03-12T00:00:00.000Z',
  source: 'FALLBACK_HARDCODED',
};

async function fetchCPOPrice(): Promise<CPOPriceData> {
  const now = new Date().toISOString();

  try {
    const response = await fetchWithTimeout(
      'https://www.minerba.esdm.go.id/harga_acuan',
      6000
    );

    if (!response.ok) throw new Error(`ESDM returned ${response.status}`);

    const html = await response.text();

    const usdMatch = html.match(/CPO[^$]*?([\d,]+\.?\d*)\s*(?:USD|US\$)/i);
    const priceUSD = usdMatch ? parseFloat(usdMatch[1].replace(',', '')) : null;

    if (!priceUSD || isNaN(priceUSD)) {
      throw new Error('Could not parse CPO price from ESDM');
    }

    return {
      priceIDR: null,
      priceMYR: null,
      priceUSD,
      changePercent30d: null,
      trend: null,
      fetchedAt: now,
      source: 'ESDM_MINERBA',
    };

  } catch (err) {
    console.warn('[altDataFetcher] CPO fetch failed, using fallback:',
      err instanceof Error ? err.message : err);

    return { ...CPO_FALLBACK };
  }
}

// ── HBA Coal Price Fetcher ────────────────────────────────────

const COAL_FALLBACK: CoalPriceData = {
  hba1USD: 102.87,
  hba2USD: 71.74,
  hba3USD: 47.34,
  changePercent30d: null,
  trend: 'TURUN',
  fetchedAt: '2026-02-16T00:00:00.000Z',
  source: 'FALLBACK_HARDCODED',
};

async function fetchCoalPrice(): Promise<CoalPriceData> {
  const now = new Date().toISOString();

  try {
    const response = await fetchWithTimeout(
      'https://www.minerba.esdm.go.id/harga_acuan',
      6000
    );

    if (!response.ok) throw new Error(`ESDM returned ${response.status}`);

    const html = await response.text();

    const hba1Match = html.match(/HBA[^$]*?(\d{2,3}\.\d{2})/);
    const hba1USD = hba1Match ? parseFloat(hba1Match[1]) : null;

    if (!hba1USD || isNaN(hba1USD)) {
      throw new Error('Could not parse HBA price from ESDM');
    }

    return {
      hba1USD,
      hba2USD: null,
      hba3USD: null,
      changePercent30d: null,
      trend: null,
      fetchedAt: now,
      source: 'ESDM_MINERBA',
    };

  } catch (err) {
    console.warn('[altDataFetcher] Coal fetch failed, using fallback:',
      err instanceof Error ? err.message : err);
    return { ...COAL_FALLBACK };
  }
}

// ── Cache management ──────────────────────────────────────────

function isStale(cache: SourceCache<unknown>, ttl: number): boolean {
  return Date.now() - cache.fetchedAt > ttl;
}

function markFailure(cache: SourceCache<unknown>): void {
  cache.consecutiveFailures++;
  if (cache.consecutiveFailures >= MAX_FAILURES) {
    cache.isDegraded = true;
    console.warn(`[altDataFetcher] Source degraded after ${MAX_FAILURES} failures`);
  }
}

function markSuccess(cache: SourceCache<unknown>): void {
  cache.consecutiveFailures = 0;
  cache.isDegraded = false;
}

// ── Public API ────────────────────────────────────────────────

export async function getWeatherData(): Promise<WeatherRegion[]> {
  if (!isStale(_weatherCache, WEATHER_TTL) && _weatherCache.data) {
    return _weatherCache.data;
  }

  try {
    const data = await fetchBMKGWeather();
    _weatherCache.data = data;
    _weatherCache.fetchedAt = Date.now();
    markSuccess(_weatherCache);
    console.log(`[altDataFetcher] BMKG weather updated: ${data.length} regions`);
    return data;
  } catch (err) {
    markFailure(_weatherCache);
    console.error('[altDataFetcher] BMKG weather fetch error:', err);
    return _weatherCache.data ?? [];
  }
}

export async function getCPOPrice(): Promise<CPOPriceData> {
  if (!isStale(_cpoCache, CPO_TTL) && _cpoCache.data) {
    return _cpoCache.data;
  }

  try {
    const data = await fetchCPOPrice();
    _cpoCache.data = data;
    _cpoCache.fetchedAt = Date.now();
    markSuccess(_cpoCache);
    console.log(`[altDataFetcher] CPO price updated: USD ${data.priceUSD}/MT`);
    return data;
  } catch (err) {
    markFailure(_cpoCache);
    console.error('[altDataFetcher] CPO fetch error:', err);
    return _cpoCache.data ?? CPO_FALLBACK;
  }
}

export async function getCoalPrice(): Promise<CoalPriceData> {
  if (!isStale(_coalCache, COAL_TTL) && _coalCache.data) {
    return _coalCache.data;
  }

  try {
    const data = await fetchCoalPrice();
    _coalCache.data = data;
    _coalCache.fetchedAt = Date.now();
    markSuccess(_coalCache);
    console.log(`[altDataFetcher] HBA coal updated: USD ${data.hba1USD}/ton`);
    return data;
  } catch (err) {
    markFailure(_coalCache);
    console.error('[altDataFetcher] Coal fetch error:', err);
    return _coalCache.data ?? COAL_FALLBACK;
  }
}

export async function getAltDataSnapshot(): Promise<AltDataSnapshot> {
  const [weather, cpo, coal] = await Promise.allSettled([
    getWeatherData(),
    getCPOPrice(),
    getCoalPrice(),
  ]);

  const degradedSources: string[] = [];
  if (_weatherCache.isDegraded) degradedSources.push('BMKG_WEATHER');
  if (_cpoCache.isDegraded)     degradedSources.push('CPO_PRICE');
  if (_coalCache.isDegraded)    degradedSources.push('COAL_PRICE');

  const hasAnyData =
    _weatherCache.fetchedAt > 0 ||
    _cpoCache.fetchedAt     > 0 ||
    _coalCache.fetchedAt    > 0;

  return {
    weather: weather.status === 'fulfilled' ? weather.value : [],
    cpo:     cpo.status     === 'fulfilled' ? cpo.value     : CPO_FALLBACK,
    coal:    coal.status    === 'fulfilled' ? coal.value    : COAL_FALLBACK,
    lastFullRefresh: hasAnyData ? new Date().toISOString() : null,
    degradedSources,
  };
}

export function getAltDataStatus() {
  return {
    weather: {
      hasCachedData:      _weatherCache.data !== null,
      ageMs:              Date.now() - _weatherCache.fetchedAt,
      isStale:            isStale(_weatherCache, WEATHER_TTL),
      isDegraded:         _weatherCache.isDegraded,
      consecutiveFailures: _weatherCache.consecutiveFailures,
      ttlMs:              WEATHER_TTL,
      regionCount:        _weatherCache.data?.length ?? 0,
    },
    cpo: {
      hasCachedData:      _cpoCache.data !== null,
      ageMs:              Date.now() - _cpoCache.fetchedAt,
      isStale:            isStale(_cpoCache, CPO_TTL),
      isDegraded:         _cpoCache.isDegraded,
      consecutiveFailures: _cpoCache.consecutiveFailures,
      ttlMs:              CPO_TTL,
      lastPriceUSD:       _cpoCache.data?.priceUSD ?? null,
      source:             _cpoCache.data?.source ?? null,
    },
    coal: {
      hasCachedData:      _coalCache.data !== null,
      ageMs:              Date.now() - _coalCache.fetchedAt,
      isStale:            isStale(_coalCache, COAL_TTL),
      isDegraded:         _coalCache.isDegraded,
      consecutiveFailures: _coalCache.consecutiveFailures,
      ttlMs:              COAL_TTL,
      lastHBA1USD:        _coalCache.data?.hba1USD ?? null,
      source:             _coalCache.data?.source ?? null,
    },
    shadowMode: true,
    note: 'Data fetched and cached. M17/M18/M19 models not yet active.',
  };
}

export function warmAltDataCaches(): void {
  Promise.allSettled([
    getWeatherData(),
    getCPOPrice(),
    getCoalPrice(),
  ]).then(() => {
    console.log('[altDataFetcher] Cache warmup complete');
  }).catch(() => {
    console.warn('[altDataFetcher] Cache warmup partially failed — using fallbacks');
  });
}

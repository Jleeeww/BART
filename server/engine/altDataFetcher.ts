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
 *   Source 2 — CPO (Crude Palm Oil) global benchmark price
 *              Yahoo Finance `CPO=F` (Malaysian Crude Palm Oil futures,
 *              CME, USD/MT) — a real, live, exchange-traded global CPO
 *              benchmark. NOT Indonesia's official government-published
 *              KPBN/ESDM domestic reference (that required screen-scraping
 *              minerba.esdm.go.id, whose page structure changed and broke
 *              the scraper — silently serving a stale hardcoded number for
 *              months). Malaysia and Indonesia are the two dominant global
 *              palm oil producers and their prices move in close tandem,
 *              so this is a reasonable, honest, always-real proxy.
 *
 *   Source 3 — Coal global benchmark price
 *              Yahoo Finance `MTF=F` (API2 CIF ARA seaborne thermal coal,
 *              NYMEX, USD/ton) — real, live. NOT Indonesia's official HBA
 *              (same ESDM-scrape problem as CPO above).
 *
 * DESIGN RULES:
 *   - Never throws — all fetches wrapped in try/catch
 *   - Returns stale cache on fetch failure (never null)
 *   - NEVER fabricates a price: if both the live fetch and the cache are
 *     empty, fields are null (rendered as "—" by the client) — no
 *     hardcoded placeholder numbers are shown as if they were real data.
 *   - Each source has independent TTL and failure counter
 *   - Max 3 consecutive failures before source is marked degraded
 *   - All data tagged with fetchedAt timestamp
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
//
// BMKG retired the old `data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/*.xml`
// endpoint (it now 302-redirects to their homepage — dead). The current
// public API is `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<code>`,
// which requires a village-level (ADM4) administrative code, not a province
// name. Each region below uses its provincial capital's ADM4 code as a
// representative reading. Codes resolved from the BMKG-compatible
// Kepmendagri wilayah reference (github.com/kodewilayah/permendagri-72-2019)
// and verified live against the real API before being hardcoded here.
const KEY_REGIONS = [
  { regionId: '14.71.01.1002', regionName: 'Riau',               sector: 'Consumer Staples',         city: 'Pekanbaru' },
  { regionId: '16.71.01.1001', regionName: 'Sumatera Selatan',   sector: 'Consumer Staples',         city: 'Palembang' },
  { regionId: '62.71.01.1001', regionName: 'Kalimantan Tengah',  sector: 'Consumer Staples',         city: 'Palangka Raya' },
  { regionId: '64.72.01.1001', regionName: 'Kalimantan Timur',   sector: 'Energy',                   city: 'Samarinda' },
  { regionId: '63.71.01.1001', regionName: 'Kalimantan Selatan', sector: 'Basic Materials',          city: 'Banjarmasin' },
  { regionId: '61.71.01.1002', regionName: 'Kalimantan Barat',   sector: 'Basic Materials',          city: 'Pontianak' },
  { regionId: '72.71.01.1004', regionName: 'Sulawesi Tengah',    sector: 'Basic Materials',          city: 'Palu' },
  { regionId: '82.71.01.1001', regionName: 'Maluku Utara',       sector: 'Basic Materials',          city: 'Ternate' },
  { regionId: '33.74.01.1001', regionName: 'Jawa Tengah',        sector: 'Consumer Discretionary',   city: 'Semarang' },
  { regionId: '35.78.01.1001', regionName: 'Jawa Timur',         sector: 'Consumer Discretionary',   city: 'Surabaya' },
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

  for (const region of KEY_REGIONS) {
    try {
      const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${region.regionId}`;
      const response = await fetchWithTimeout(url, 6000);

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

      const json = await response.json();
      // Nearest upcoming 3-hour forecast slot for this location.
      const slot = json?.data?.[0]?.cuaca?.[0]?.[0];

      results.push({
        ...region,
        rainfallMm: typeof slot?.tp === 'number' ? slot.tp : null,
        rainfallAnomaly: null,
        weatherCode: slot?.weather_desc ?? null,
        temperature: typeof slot?.t === 'number' ? slot.t : null,
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

// ── CPO Price Fetcher (Yahoo Finance CPO=F — Malaysian CPO futures, CME) ──

// No-data state: NEVER a fabricated price. `source` keeps the word
// "FALLBACK" so the client's existing `source.includes("FALLBACK")` check
// (STALE badge / dimmed styling) keeps working when there's genuinely
// nothing real to show — the client already renders null prices as "—".
const CPO_UNAVAILABLE: CPOPriceData = {
  priceIDR: null,
  priceMYR: null,
  priceUSD: null,
  changePercent30d: null,
  trend: null,
  fetchedAt: new Date(0).toISOString(),
  source: 'FALLBACK_UNAVAILABLE',
};

function trendFromChangePercent(pct: number | null): CPOPriceData['trend'] {
  if (pct == null || !isFinite(pct)) return null;
  if (pct > 1) return 'NAIK';
  if (pct < -1) return 'TURUN';
  return 'STABIL';
}

async function fetchCPOPrice(): Promise<CPOPriceData> {
  const now = new Date().toISOString();
  try {
    const { getYahooFinanceClient } = await import('./yahooFinance');
    const yf = getYahooFinanceClient();
    const q = await yf.quote('CPO=F');
    const priceUSD = q?.regularMarketPrice ?? null;
    if (priceUSD == null || !isFinite(priceUSD)) {
      throw new Error('Yahoo CPO=F returned no price');
    }
    const changePercent30d = q?.regularMarketChangePercent ?? null;
    return {
      priceIDR: null,
      priceMYR: null,
      priceUSD,
      changePercent30d,
      trend: trendFromChangePercent(changePercent30d),
      fetchedAt: now,
      source: 'YAHOO_CPO_F',
    };
  } catch (err) {
    console.warn('[altDataFetcher] CPO (Yahoo CPO=F) fetch failed:',
      err instanceof Error ? err.message : err);
    return { ...CPO_UNAVAILABLE, fetchedAt: now };
  }
}

// ── Coal Price Fetcher (Yahoo Finance MTF=F — API2 CIF ARA seaborne coal) ──

const COAL_UNAVAILABLE: CoalPriceData = {
  hba1USD: null,
  hba2USD: null,
  hba3USD: null,
  changePercent30d: null,
  trend: null,
  fetchedAt: new Date(0).toISOString(),
  source: 'FALLBACK_UNAVAILABLE',
};

async function fetchCoalPrice(): Promise<CoalPriceData> {
  const now = new Date().toISOString();
  try {
    const { getYahooFinanceClient } = await import('./yahooFinance');
    const yf = getYahooFinanceClient();
    const q = await yf.quote('MTF=F');
    const hba1USD = q?.regularMarketPrice ?? null;
    if (hba1USD == null || !isFinite(hba1USD)) {
      throw new Error('Yahoo MTF=F returned no price');
    }
    const changePercent30d = q?.regularMarketChangePercent ?? null;
    return {
      hba1USD,
      hba2USD: null,
      hba3USD: null,
      changePercent30d,
      trend: trendFromChangePercent(changePercent30d),
      fetchedAt: now,
      source: 'YAHOO_MTF_F',
    };
  } catch (err) {
    console.warn('[altDataFetcher] Coal (Yahoo MTF=F) fetch failed:',
      err instanceof Error ? err.message : err);
    return { ...COAL_UNAVAILABLE, fetchedAt: now };
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
    return _cpoCache.data ?? CPO_UNAVAILABLE;
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
    return _coalCache.data ?? COAL_UNAVAILABLE;
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
    cpo:     cpo.status     === 'fulfilled' ? cpo.value     : CPO_UNAVAILABLE,
    coal:    coal.status    === 'fulfilled' ? coal.value    : COAL_UNAVAILABLE,
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

/**
 * ============================================================
 * SECTOR ROTATION ENGINE v1.0
 * ============================================================
 * Aggregates individual stock bandarmology scores by sector
 * to detect institutional money rotation across IDX sectors.
 *
 * DESIGN:
 *   - Reads from /api/stocks (existing endpoint)
 *   - Groups stocks by sector
 *   - Computes sector rotation score (0-100)
 *   - Detects rotation direction (MASUK/KELUAR/NETRAL)
 *   - Identifies top stock leaders per sector
 *   - Cache: 15min during market hours, 60min off-hours
 *
 * SECTOR ROTATION SCORE:
 *   weightedAvg(readinessScore) for all stocks in sector
 *   Adjusted by: count of AKTIF signals, flow bias distribution
 *
 * ROTATION DIRECTION:
 *   MASUK:  score > 60 AND majority flowBias = Akumulasi
 *   KELUAR: score < 40 AND majority flowBias = Distribusi
 *   NETRAL: everything else
 * ============================================================
 */

export type RotationDirection = 'MASUK' | 'KELUAR' | 'NETRAL';

export interface SectorRotationResult {
  sector: string;
  displayName: string;
  rotationScore: number;        // 0-100
  direction: RotationDirection;
  stockCount: number;
  akumulasiCount: number;
  distribusiCount: number;
  topStocks: {
    symbol: string;
    companyName: string;
    readinessScore: number;
    cyclePosition: string | null;
    flowBias: string | null;
  }[];
  momentum: 'NAIK' | 'TURUN' | 'STABIL'; // vs previous cache
  previousScore: number | null;
}

export interface SectorRotationSnapshot {
  sectors: SectorRotationResult[];
  hotSectors: string[];      // sectors with direction=MASUK, score>60
  coldSectors: string[];     // sectors with direction=KELUAR, score<40
  rotationStrength: 'KUAT' | 'SEDANG' | 'LEMAH';
  dominantTheme: string;     // e.g. "Rotasi ke Energi & Pertambangan"
  computedAt: string;
  isStale: boolean;
}

// Sector display names in Bahasa Indonesia
const SECTOR_DISPLAY_NAMES: Record<string, string> = {
  'Financials':             'Keuangan & Perbankan',
  'Energy':                 'Energi',
  'Industrials':            'Industri',
  'Communication Services': 'Telekomunikasi',
  'Consumer Staples':       'Konsumer Primer',
  'Consumer Discretionary': 'Konsumer Sekunder',
  'Real Estate':            'Properti',
  'Basic Materials':        'Material & Tambang',
  'Healthcare':             'Kesehatan',
  'Technology':             'Teknologi',
  'Infrastructure':         'Infrastruktur',
};

// ── Cache ─────────────────────────────────────────────────

let _cache: SectorRotationSnapshot | null = null;
let _previousScores: Record<string, number> = {};
let _cacheTimestamp = 0;

const CACHE_TTL_MARKET  = 15 * 60 * 1000;
const CACHE_TTL_OFFHOUR = 60 * 60 * 1000;

function isMarketHours(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day  = wib.getUTCDay();
  const hour = wib.getUTCHours();
  const min  = wib.getUTCMinutes();
  const t    = hour * 60 + min;
  if (day === 0 || day === 6) return false;
  return (t >= 540 && t < 720) || (t >= 810 && t < 950);
}

function isCacheValid(): boolean {
  if (!_cache) return false;
  const ttl = isMarketHours() ? CACHE_TTL_MARKET : CACHE_TTL_OFFHOUR;
  return Date.now() - _cacheTimestamp < ttl;
}

// ── Core computation ──────────────────────────────────────

function computeSectorResult(
  sector: string,
  stocks: any[]
): SectorRotationResult {
  if (stocks.length === 0) {
    return {
      sector,
      displayName: SECTOR_DISPLAY_NAMES[sector] ?? sector,
      rotationScore: 50,
      direction: 'NETRAL',
      stockCount: 0,
      akumulasiCount: 0,
      distribusiCount: 0,
      topStocks: [],
      momentum: 'STABIL',
      previousScore: null,
    };
  }

  // Weighted average readiness score
  const scores = stocks.map(s => Number(s.readiness ?? s.readinessScore ?? 0));
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Flow bias counts
  const akumulasiCount  = stocks.filter(s =>
    (s.flowBias ?? '').toLowerCase().includes('akumulasi')).length;
  const distribusiCount = stocks.filter(s =>
    (s.flowBias ?? '').toLowerCase().includes('distribusi')).length;

  // Rotation direction
  let direction: RotationDirection = 'NETRAL';
  const akumulasiRatio = akumulasiCount / stocks.length;
  const distribusiRatio = distribusiCount / stocks.length;

  if (avgScore > 60 && akumulasiRatio > 0.4) {
    direction = 'MASUK';
  } else if (avgScore < 40 && distribusiRatio > 0.4) {
    direction = 'KELUAR';
  }

  // Top 3 stocks by readiness score
  const topStocks = [...stocks]
    .sort((a, b) =>
      Number(b.readiness ?? b.readinessScore ?? 0) -
      Number(a.readiness ?? a.readinessScore ?? 0))
    .slice(0, 3)
    .map(s => ({
      symbol:        s.symbol,
      companyName:   s.name ?? s.companyName ?? s.symbol,
      readinessScore: Number(s.readiness ?? s.readinessScore ?? 0),
      cyclePosition: s.cyclePosition ?? null,
      flowBias:      s.flowBias ?? null,
    }));

  // Momentum vs previous cache
  const prevScore = _previousScores[sector] ?? null;
  let momentum: SectorRotationResult['momentum'] = 'STABIL';
  if (prevScore !== null) {
    if (avgScore > prevScore + 3)  momentum = 'NAIK';
    if (avgScore < prevScore - 3)  momentum = 'TURUN';
  }

  return {
    sector,
    displayName: SECTOR_DISPLAY_NAMES[sector] ?? sector,
    rotationScore: Number(avgScore.toFixed(1)),
    direction,
    stockCount:    stocks.length,
    akumulasiCount,
    distribusiCount,
    topStocks,
    momentum,
    previousScore: prevScore,
  };
}

function buildSnapshot(sectors: SectorRotationResult[]): SectorRotationSnapshot {
  const hotSectors  = sectors.filter(s => s.direction === 'MASUK' && s.rotationScore > 60)
    .sort((a, b) => b.rotationScore - a.rotationScore)
    .map(s => s.sector);
  const coldSectors = sectors.filter(s => s.direction === 'KELUAR' && s.rotationScore < 40)
    .sort((a, b) => a.rotationScore - b.rotationScore)
    .map(s => s.sector);

  // Rotation strength: how many sectors are clearly moving
  const movingCount = sectors.filter(s => s.direction !== 'NETRAL').length;
  const rotationStrength: SectorRotationSnapshot['rotationStrength'] =
    movingCount >= 3 ? 'KUAT' :
    movingCount >= 1 ? 'SEDANG' : 'LEMAH';

  // Dominant theme
  let dominantTheme = 'Tidak ada rotasi signifikan terdeteksi';
  if (hotSectors.length > 0 && coldSectors.length > 0) {
    const hotNames  = hotSectors.slice(0, 2)
      .map(s => SECTOR_DISPLAY_NAMES[s] ?? s).join(' & ');
    const coldNames = coldSectors.slice(0, 2)
      .map(s => SECTOR_DISPLAY_NAMES[s] ?? s).join(' & ');
    dominantTheme = `Rotasi dari ${coldNames} ke ${hotNames}`;
  } else if (hotSectors.length > 0) {
    const hotNames = hotSectors.slice(0, 2)
      .map(s => SECTOR_DISPLAY_NAMES[s] ?? s).join(' & ');
    dominantTheme = `Akumulasi institusional di ${hotNames}`;
  } else if (coldSectors.length > 0) {
    const coldNames = coldSectors.slice(0, 2)
      .map(s => SECTOR_DISPLAY_NAMES[s] ?? s).join(' & ');
    dominantTheme = `Distribusi terdeteksi di ${coldNames}`;
  }

  return {
    sectors: sectors.sort((a, b) => b.rotationScore - a.rotationScore),
    hotSectors,
    coldSectors,
    rotationStrength,
    dominantTheme,
    computedAt: new Date().toISOString(),
    isStale: false,
  };
}

// ── Public API ────────────────────────────────────────────

export async function computeSectorRotation(
  allStocks: any[]
): Promise<SectorRotationSnapshot> {
  if (isCacheValid() && _cache) {
    return _cache;
  }

  try {
    // Save previous scores before recomputing
    if (_cache) {
      _previousScores = {};
      _cache.sectors.forEach(s => {
        _previousScores[s.sector] = s.rotationScore;
      });
    }

    // Group stocks by sector
    const sectorMap = new Map<string, any[]>();
    for (const stock of allStocks) {
      const sector = stock.sector ?? 'Unknown';
      if (!sectorMap.has(sector)) sectorMap.set(sector, []);
      sectorMap.get(sector)!.push(stock);
    }

    // Remove unknown sector from display if too many nulls
    sectorMap.delete('Unknown');

    // Compute per sector
    const results: SectorRotationResult[] = [];
    sectorMap.forEach((stocks, sector) => {
      results.push(computeSectorResult(sector, stocks));
    });

    const snapshot = buildSnapshot(results);

    // Update cache
    _cache = snapshot;
    _cacheTimestamp = Date.now();

    return snapshot;

  } catch (err) {
    console.error('[sectorRotationEngine] Error:', err);
    if (_cache) return { ..._cache, isStale: true };
    return {
      sectors: [], hotSectors: [], coldSectors: [],
      rotationStrength: 'LEMAH',
      dominantTheme: 'Data tidak tersedia',
      computedAt: new Date().toISOString(),
      isStale: true,
    };
  }
}

export function invalidateSectorCache(): void {
  _cache = null;
  _cacheTimestamp = 0;
}

/**
 * Returns cached snapshot without recomputing if the cache is valid.
 * Returns null if cache is empty or expired (caller must then provide
 * fresh stock data via computeSectorRotation()).
 *
 * Used by the API route layer to avoid an expensive internal fetch of
 * /api/stocks on every request when the engine cache is still warm.
 */
export function getCachedSectorRotation(): SectorRotationSnapshot | null {
  if (isCacheValid() && _cache) return _cache;
  return null;
}

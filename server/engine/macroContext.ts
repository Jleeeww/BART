/**
 * ============================================================
 * MACRO CONTEXT ENGINE v1.0
 * ============================================================
 * Fetches commodity prices and forex data from free public APIs.
 * Maps macro signals to sector implications.
 * Cross-references with sector rotation data.
 *
 * DATA SOURCES (all free, no API key required):
 *   Oil (WTI): https://query1.finance.yahoo.com/v8/finance/chart/CL=F
 *   Gold:      https://query1.finance.yahoo.com/v8/finance/chart/GC=F
 *   USD/IDR:   https://query1.finance.yahoo.com/v8/finance/chart/USDIDR=X
 *   CPO/Coal:  already in altDataFetcher.ts
 *
 * CACHE TTL: 60 minutes (macro data changes slowly)
 * ============================================================
 */

export interface CommodityPrice {
  name: string;
  currentPrice: number | null;
  change5d: number | null;      // % change over 5 days
  change5dAbs: number | null;   // absolute change
  trend: 'NAIK' | 'TURUN' | 'STABIL' | null;
  unit: string;
  fetchedAt: string;
  source: 'LIVE' | 'FALLBACK';
}

export interface MacroSignal {
  type: string;                 // e.g. 'oil_up', 'idr_weak'
  sector: string;               // affected sector
  effect: 'POSITIF' | 'NEGATIF' | 'NETRAL';
  strength: 'KUAT' | 'SEDANG' | 'LEMAH';
  description: string;          // Bahasa Indonesia
}

export interface MacroContextResult {
  oil:     CommodityPrice;
  gold:    CommodityPrice;
  usdIdr:  CommodityPrice;
  signals: MacroSignal[];
  marketSentiment: 'RISK_ON' | 'RISK_OFF' | 'NETRAL';
  sentimentReason: string;
  computedAt: string;
  isStale: boolean;
}

// ── Fallback prices (updated periodically) ───────────────

const FALLBACKS = {
  oil:    { price: 82.5,   unit: 'USD/barrel', name: 'Minyak WTI' },
  gold:   { price: 2320.0, unit: 'USD/oz',     name: 'Emas' },
  usdIdr: { price: 15850,  unit: 'IDR/USD',    name: 'USD/IDR' },
};

// ── Cache (input-aware: keyed by cpo/coal trend inputs) ──

let _macroCache: MacroContextResult | null = null;
let _macroCacheTime = 0;
let _macroCacheKey: string | null = null;
const MACRO_TTL = 60 * 60 * 1000; // 60 minutes

function buildCacheKey(cpoTrend: string | null, coalTrend: string | null): string {
  return `${cpoTrend ?? 'null'}|${coalTrend ?? 'null'}`;
}

function isMacroCacheValid(key: string): boolean {
  return _macroCache !== null
    && _macroCacheKey === key
    && Date.now() - _macroCacheTime < MACRO_TTL;
}

// ── Yahoo Finance fetcher ─────────────────────────────────

async function fetchYahooPrice(
  ticker: string,
  name: string,
  unit: string
): Promise<CommodityPrice> {
  const now = new Date().toISOString();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators
      ?.quote?.[0]?.close as (number | null)[];

    if (!closes || closes.length < 2) throw new Error('No price data');

    // Filter nulls
    const valid = closes.filter((p): p is number => p !== null && isFinite(p));
    if (valid.length < 2) throw new Error('Insufficient valid prices');

    const current = valid[valid.length - 1];
    const fiveDayAgo = valid[Math.max(0, valid.length - 6)];
    const change5d = fiveDayAgo > 0
      ? Number(((current - fiveDayAgo) / fiveDayAgo * 100).toFixed(2))
      : null;
    const change5dAbs = fiveDayAgo > 0
      ? Number((current - fiveDayAgo).toFixed(2))
      : null;

    const trend: CommodityPrice['trend'] =
      change5d === null ? null :
      change5d > 1 ? 'NAIK' :
      change5d < -1 ? 'TURUN' : 'STABIL';

    return {
      name, currentPrice: Number(current.toFixed(2)),
      change5d, change5dAbs, trend, unit,
      fetchedAt: now, source: 'LIVE',
    };

  } catch (err) {
    console.warn(`[macroContext] ${ticker} fetch failed:`, err);
    const fallback = ticker === 'CL=F' ? FALLBACKS.oil
      : ticker === 'GC=F' ? FALLBACKS.gold
      : FALLBACKS.usdIdr;

    return {
      name: fallback.name,
      currentPrice: fallback.price,
      change5d: null, change5dAbs: null, trend: null,
      unit: fallback.unit, fetchedAt: now, source: 'FALLBACK',
    };
  }
}

// ── Signal generator ──────────────────────────────────────

function generateMacroSignals(
  oil: CommodityPrice,
  gold: CommodityPrice,
  usdIdr: CommodityPrice,
  cpoTrend: string | null,
  coalTrend: string | null,
): MacroSignal[] {
  const signals: MacroSignal[] = [];

  // Oil signals
  if (oil.change5d !== null) {
    if (oil.change5d > 5) {
      signals.push({
        type: 'oil_surge',
        sector: 'Energy',
        effect: 'POSITIF',
        strength: 'KUAT',
        description: `Minyak naik ${oil.change5d.toFixed(1)}% dalam 5 hari — menguntungkan saham energi`,
      });
    } else if (oil.change5d > 2) {
      signals.push({
        type: 'oil_up',
        sector: 'Energy',
        effect: 'POSITIF',
        strength: 'SEDANG',
        description: `Minyak menguat ${oil.change5d.toFixed(1)}% — positif untuk sektor energi`,
      });
    } else if (oil.change5d < -5) {
      signals.push({
        type: 'oil_drop',
        sector: 'Energy',
        effect: 'NEGATIF',
        strength: 'KUAT',
        description: `Minyak turun ${Math.abs(oil.change5d).toFixed(1)}% — tekanan pada saham energi`,
      });
    }
  }

  // USD/IDR signals
  if (usdIdr.change5d !== null) {
    // IDR weakening = USD/IDR rate going up
    if (usdIdr.change5d > 1.5) {
      signals.push({
        type: 'idr_weak',
        sector: 'Financials',
        effect: 'NEGATIF',
        strength: 'SEDANG',
        description: `Rupiah melemah ${usdIdr.change5d.toFixed(1)}% — waspada tekanan aliran asing`,
      });
    } else if (usdIdr.change5d < -1.0) {
      signals.push({
        type: 'idr_strong',
        sector: 'Financials',
        effect: 'POSITIF',
        strength: 'SEDANG',
        description: `Rupiah menguat ${Math.abs(usdIdr.change5d).toFixed(1)}% — positif untuk aliran asing masuk`,
      });
    }
  }

  // Gold signals (risk-off indicator)
  if (gold.change5d !== null) {
    if (gold.change5d > 3) {
      signals.push({
        type: 'gold_surge',
        sector: 'ALL',
        effect: 'NEGATIF',
        strength: 'SEDANG',
        description: `Emas naik ${gold.change5d.toFixed(1)}% — indikasi risk-off, investor cari aset aman`,
      });
    }
  }

  // CPO signal
  if (cpoTrend === 'NAIK') {
    signals.push({
      type: 'cpo_up',
      sector: 'Consumer Staples',
      effect: 'POSITIF',
      strength: 'SEDANG',
      description: 'Harga CPO menguat — positif untuk emiten perkebunan dan konsumer',
    });
  } else if (cpoTrend === 'TURUN') {
    signals.push({
      type: 'cpo_down',
      sector: 'Consumer Staples',
      effect: 'NEGATIF',
      strength: 'LEMAH',
      description: 'Harga CPO melemah — tekanan marginal pada emiten perkebunan',
    });
  }

  // Coal signal
  if (coalTrend === 'TURUN') {
    signals.push({
      type: 'coal_down',
      sector: 'Energy',
      effect: 'NEGATIF',
      strength: 'SEDANG',
      description: 'Harga batu bara HBA menurun — tekanan pada emiten pertambangan batu bara',
    });
  } else if (coalTrend === 'NAIK') {
    signals.push({
      type: 'coal_up',
      sector: 'Energy',
      effect: 'POSITIF',
      strength: 'KUAT',
      description: 'Harga batu bara HBA menguat — katalis positif untuk ADRO, BUMI, SGER',
    });
  }

  return signals;
}

function computeSentiment(
  signals: MacroSignal[],
  goldChange: number | null
): { sentiment: MacroContextResult['marketSentiment']; reason: string } {
  const negativeCount = signals.filter(s => s.effect === 'NEGATIF').length;
  const positiveCount = signals.filter(s => s.effect === 'POSITIF').length;

  if (goldChange !== null && goldChange > 3 && negativeCount > positiveCount) {
    return {
      sentiment: 'RISK_OFF',
      reason: 'Emas menguat dan sinyal makro negatif mendominasi — investor defensif',
    };
  }
  if (positiveCount > negativeCount && positiveCount >= 2) {
    return {
      sentiment: 'RISK_ON',
      reason: 'Sinyal makro positif mendominasi — kondisi mendukung untuk ekuitas',
    };
  }
  return {
    sentiment: 'NETRAL',
    reason: 'Sinyal makro campuran — tidak ada bias jelas saat ini',
  };
}

// ── Public API ────────────────────────────────────────────

export async function getMacroContext(
  cpoTrend: string | null = null,
  coalTrend: string | null = null
): Promise<MacroContextResult> {
  const cacheKey = buildCacheKey(cpoTrend, coalTrend);
  if (isMacroCacheValid(cacheKey) && _macroCache) {
    return _macroCache;
  }

  const [oil, gold, usdIdr] = await Promise.allSettled([
    fetchYahooPrice('CL=F',     'Minyak WTI', 'USD/barrel'),
    fetchYahooPrice('GC=F',     'Emas',        'USD/oz'),
    fetchYahooPrice('USDIDR=X', 'USD/IDR',     'IDR/USD'),
  ]);

  const oilData    = oil.status    === 'fulfilled' ? oil.value
    : { name:'Minyak WTI', currentPrice: FALLBACKS.oil.price, change5d:null, change5dAbs:null, trend:null, unit:'USD/barrel', fetchedAt:new Date().toISOString(), source:'FALLBACK' as const };
  const goldData   = gold.status   === 'fulfilled' ? gold.value
    : { name:'Emas', currentPrice: FALLBACKS.gold.price, change5d:null, change5dAbs:null, trend:null, unit:'USD/oz', fetchedAt:new Date().toISOString(), source:'FALLBACK' as const };
  const usdIdrData = usdIdr.status === 'fulfilled' ? usdIdr.value
    : { name:'USD/IDR', currentPrice: FALLBACKS.usdIdr.price, change5d:null, change5dAbs:null, trend:null, unit:'IDR/USD', fetchedAt:new Date().toISOString(), source:'FALLBACK' as const };

  const signals = generateMacroSignals(
    oilData, goldData, usdIdrData, cpoTrend, coalTrend
  );

  const { sentiment, reason } = computeSentiment(signals, goldData.change5d);

  const result: MacroContextResult = {
    oil:    oilData,
    gold:   goldData,
    usdIdr: usdIdrData,
    signals,
    marketSentiment: sentiment,
    sentimentReason: reason,
    computedAt: new Date().toISOString(),
    isStale: false,
  };

  _macroCache    = result;
  _macroCacheTime = Date.now();
  _macroCacheKey  = cacheKey;
  return result;
}

export function invalidateMacroCache(): void {
  _macroCache    = null;
  _macroCacheTime = 0;
  _macroCacheKey  = null;
}

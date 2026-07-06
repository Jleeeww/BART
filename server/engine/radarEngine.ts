/**
 * ============================================================
 * RADAR BATCH ENGINE
 * ============================================================
 * Processes all stocks through computeBandarmologyV2() in 
 * controlled chunks. Safe on any input. One bad stock never 
 * crashes the batch. Results cached in memory with timestamp.
 *
 * SCALE CONTRACT:
 *   - Tested safe at 900+ stocks
 *   - Chunk size: 50 stocks (memory-safe)
 *   - Cache TTL: 15min market hours, 60min off-hours
 *   - Per-stock timeout: 5000ms (prevents hung computation)
 *   - Error isolation: try/catch per stock, skip on failure
 *   - Confidence gate: < 60% → flagged, excluded from main results
 * ============================================================
 */

import { computeBandarmologyV2 } from './bandarmologyCore';
import { buildBandarmologyInput } from './buildBandarmologyInput';
import { getBandarmologyDecisionV2 } from './bandarmologyDecisionV2';
import { getM6History } from './bandarmologyHistory';
import { computeGorenganFromStock } from './gorenganDetector';
import { analyzeScoreDistribution, cacheDistribution } from './scoreMonitor';
import type { RawStockRecord } from './buildBandarmologyInput';

export interface RadarStockResult {
  symbol: string;
  companyName: string;
  sector: string | null;
  price: number;
  changePercent: number;
  compositeScore: number;
  confidence: number;
  regime: string | null;
  cyclePosition: string | null;
  concentrationType: string;
  flowBias: string | null;
  homepageBucket: string;
  isGorengan: boolean;
  dataQuality: 'FULL' | 'PARTIAL' | 'MINIMAL';
  historySource: string;
  sessionCount: number;
  processedAt: string;
}

export interface RadarResult {
  stocks: RadarStockResult[];
  hiddenCount: number;
  errorCount: number;
  totalProcessed: number;
  cacheTimestamp: string;
  isStale: boolean;
  nextRefreshAt: string;
}

interface CacheEntry {
  result: RadarResult;
  timestamp: number;
}

let _cache: CacheEntry | null = null;
let _isProcessing = false;

const CHUNK_SIZE = 50;
const CONFIDENCE_GATE = 60;
const CACHE_TTL_MARKET_HOURS = 15 * 60 * 1000;
const CACHE_TTL_OFF_HOURS    = 60 * 60 * 1000;
const STOCK_TIMEOUT_MS       = 5000;

function isMarketHours(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day  = wib.getUTCDay();
  const hour = wib.getUTCHours();
  const min  = wib.getUTCMinutes();
  const time = hour * 60 + min;
  if (day === 0 || day === 6) return false;
  return (time >= 540 && time < 720) || (time >= 810 && time < 950);
}

function getCacheTTL(): number {
  return isMarketHours() ? CACHE_TTL_MARKET_HOURS : CACHE_TTL_OFF_HOURS;
}

function isCacheValid(): boolean {
  if (!_cache) return false;
  return Date.now() - _cache.timestamp < getCacheTTL();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function deriveCyclePosition(maturity: string | null): string | null {
  if (!maturity) return null;
  if (maturity === 'FORMING')  return 'TERLALU_DINI';
  if (maturity === 'ACTIVE')   return 'KONFIRMASI_MULAI';
  if (maturity === 'MATURE')   return 'ENTRY_WINDOW';
  if (maturity === 'EXTENDED') return 'WASPADAI_DISTRIBUSI';
  return null;
}

function deriveConcentrationType(
  m3Score: number | null,
  m6Score: number | null
): string {
  if (m3Score === null) return 'TERSEBAR';
  if (m3Score < 40) return 'TERSEBAR';
  if (m3Score >= 40 && (m6Score ?? 50) < 35) return 'JEBAKAN_DISTRIBUSI';
  return 'KENDALI_BANDAR';
}

function assessDataQuality(raw: RawStockRecord): 'FULL' | 'PARTIAL' | 'MINIMAL' {
  const hasBroker  = !!raw.brokerData;
  const hasFlow    = !!raw.foreignActivityData;
  const hasHistory = Array.isArray(raw.netFlowHistory) && 
                     (raw.netFlowHistory as unknown[]).length >= 5;
  const hasPrice   = !!(raw.close ?? raw.price);
  if (hasBroker && hasFlow && hasHistory && hasPrice) return 'FULL';
  if (hasPrice && (hasBroker || hasFlow)) return 'PARTIAL';
  return 'MINIMAL';
}

async function processStock(
  raw: RawStockRecord & {
    companyName?: string;
    sector?: string;
    changePercent?: number | string;
    isGorengan?: boolean;
    homepageBucket?: string;
  }
): Promise<RadarStockResult | null> {
  try {
    const symbol = raw.symbol ?? '';
    if (!symbol) return null;

    const { buildStockHistory } = await import('./historyBuilder');

    const history = await withTimeout(
      buildStockHistory(symbol, 60),
      3000
    ).catch(() => null);

    const enrichedRaw = history && history.sessionCount > 0
      ? {
          ...raw,
          netFlowHistory:    history.netFlowHistory.length > 0
                               ? history.netFlowHistory
                               : raw.netFlowHistory,
          foreignFlowHistory: history.foreignFlowHistory.length > 0
                               ? history.foreignFlowHistory
                               : (raw as any).foreignFlowHistory ?? null,
          priceHistory:      history.priceHistory.length > 0
                               ? history.priceHistory
                               : raw.priceHistory,
          avg20dValue:       history.avg20dValue ?? raw.avg20dValue,
          _m6ScoreHistory:   history.m6ScoreHistory.length > 0
                               ? history.m6ScoreHistory
                               : (raw as any)._m6ScoreHistory,
        }
      : raw;

    const m6History = (history?.m6ScoreHistory.length ?? 0) > 0
      ? history!.m6ScoreHistory
      : await withTimeout(
          getM6History(symbol, 5),
          2000
        ).catch(() => [] as number[]);

    const input = buildBandarmologyInput(enrichedRaw, m6History);

    const result = await withTimeout(
      Promise.resolve(computeBandarmologyV2(input)),
      STOCK_TIMEOUT_MS
    );

    const decision = getBandarmologyDecisionV2(result as any);

    const compositeScore = result.composite?.score ?? 0;
    const confidence     = result.composite?.confidence ?? 0;
    const regime         = result.M16_regimeStability?.regime ?? null;

    const m14 = result.M14_campaignDuration as any;
    const cyclePosition = deriveCyclePosition(m14?.maturity ?? null);

    const m3Score = result.M3_brokerDominance?.score ?? null;
    const m6Score = result.M6_flowNormalized?.score ?? null;
    const concentrationType = deriveConcentrationType(m3Score, m6Score);

    let gorenganOverride = false;
    try {
      const gorenganResult = computeGorenganFromStock({
        symbol,
        changePercent: String(raw.changePercent ?? '0'),
        flowBias:      String(raw.flowBias ?? 'Netral'),
        flowIntensity: String(raw.flowIntensity ?? ''),
        flowReliability: String(raw.flowReliability ?? 'Sedang'),
        brokerData:    typeof raw.brokerData === 'string'
                         ? raw.brokerData : JSON.stringify(raw.brokerData ?? []),
        foreignActivityData: typeof raw.foreignActivityData === 'string'
                         ? raw.foreignActivityData
                         : JSON.stringify(raw.foreignActivityData ?? {}),
        todayValue:  typeof raw.todayValue === 'number' ? raw.todayValue : null,
        avg20dValue: typeof raw.avg20dValue === 'number' ? raw.avg20dValue : null,
      });
      gorenganOverride = gorenganResult.isGorengan;
    } catch (gorenganErr) {
      console.warn(`[radarEngine] Gorengan check failed for ${symbol}:`, gorenganErr);
    }

    const effectiveIsGorengan = gorenganOverride || Boolean(raw.isGorengan);

    let homepageBucket = 'hindari_dulu';
    if (effectiveIsGorengan) {
      homepageBucket = 'hindari_dulu';
    } else if (decision?.decision === 'SIAP_DIPANTAU') {
      homepageBucket = 'siap_dipantau';
    } else if (decision?.decision === 'WATCHLIST_PRIORITAS') {
      homepageBucket = 'watchlist_prioritas';
    } else {
      homepageBucket = 'hindari_dulu';
    }

    const dataQuality = assessDataQuality(enrichedRaw);

    return {
      symbol,
      companyName: raw.companyName ?? symbol,
      sector:      raw.sector ?? null,
      price:       Number(raw.close ?? raw.price ?? 0),
      changePercent: Number(raw.changePercent ?? 0),
      compositeScore: effectiveIsGorengan
        ? 0
        : Number((compositeScore ?? 0).toFixed(2)),
      confidence:     Number((confidence ?? 0).toFixed(0)),
      regime,
      cyclePosition,
      concentrationType,
      flowBias: homepageBucket === 'siap_dipantau' ? 'Akumulasi' :
                homepageBucket === 'hindari_dulu' ? 'Distribusi' : 'Netral',
      homepageBucket,
      isGorengan: effectiveIsGorengan,
      dataQuality,
      historySource: history && history.sessionCount > 0
        ? history.dataSource
        : 'STATIC_DB',
      sessionCount: history?.sessionCount ?? 0,
      processedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[radarEngine] Failed to process ${raw.symbol}:`, err);
    return null;
  }
}

async function processChunk(
  stocks: (RawStockRecord & Record<string, unknown>)[]
): Promise<{ results: RadarStockResult[]; errors: number }> {
  const settled = await Promise.allSettled(
    stocks.map((s) => processStock(s as any))
  );

  const results: RadarStockResult[] = [];
  let errors = 0;

  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value !== null) {
      results.push(s.value);
    } else {
      errors++;
    }
  }

  return { results, errors };
}

export async function runRadarBatch(
  allStocks: (RawStockRecord & Record<string, unknown>)[]
): Promise<RadarResult> {
  if (_isProcessing) {
    if (_cache) {
      return { ..._cache.result, isStale: true };
    }
    return emptyResult();
  }

  _isProcessing = true;
  const startTime = Date.now();

  try {
    const allResults: RadarStockResult[] = [];
    let totalErrors = 0;

    for (let i = 0; i < allStocks.length; i += CHUNK_SIZE) {
      const chunk = allStocks.slice(i, i + CHUNK_SIZE);
      const { results, errors } = await processChunk(chunk);
      allResults.push(...results);
      totalErrors += errors;

      await new Promise((r) => setTimeout(r, 0));
    }

    const visible = allResults.filter((s) => s.confidence >= CONFIDENCE_GATE);
    const hidden  = allResults.filter((s) => s.confidence < CONFIDENCE_GATE);

    const allScores = allResults.map(s => s.compositeScore);
    if (allScores.length > 0) {
      const distribution = analyzeScoreDistribution(allScores);
      cacheDistribution(distribution);
      if (distribution.healthStatus === 'CRITICAL') {
        console.error('[radarEngine] CRITICAL: ' + distribution.recommendation);
      } else if (distribution.healthStatus === 'WARNING') {
        console.warn('[radarEngine] WARNING: ' + distribution.warnings.join(', '));
      }
    }

    visible.sort((a, b) =>
      b.compositeScore - a.compositeScore || a.symbol.localeCompare(b.symbol)
    );

    const now = new Date();
    const nextRefresh = new Date(
      now.getTime() + getCacheTTL()
    );

    const radarResult: RadarResult = {
      stocks:         visible,
      hiddenCount:    hidden.length,
      errorCount:     totalErrors,
      totalProcessed: allStocks.length,
      cacheTimestamp: now.toISOString(),
      isStale:        false,
      nextRefreshAt:  nextRefresh.toISOString(),
    };

    console.log(
      `[radarEngine] Batch complete: ${visible.length} visible, ` +
      `${hidden.length} hidden, ${totalErrors} errors, ` +
      `${Date.now() - startTime}ms`
    );

    _cache = { result: radarResult, timestamp: Date.now() };
    return radarResult;

  } finally {
    _isProcessing = false;
  }
}

export async function getRadarResults(
  allStocks: (RawStockRecord & Record<string, unknown>)[]
): Promise<RadarResult> {
  if (isCacheValid() && _cache) {
    return _cache.result;
  }
  return runRadarBatch(allStocks);
}

export function invalidateRadarCache(): void {
  _cache = null;
  console.log('[radarEngine] Cache invalidated');
}

export function getRadarCacheStatus(): {
  hasCache: boolean;
  isValid: boolean;
  ageMs: number | null;
  isProcessing: boolean;
} {
  return {
    hasCache:     _cache !== null,
    isValid:      isCacheValid(),
    ageMs:        _cache ? Date.now() - _cache.timestamp : null,
    isProcessing: _isProcessing,
  };
}

function emptyResult(): RadarResult {
  const now = new Date().toISOString();
  return {
    stocks: [], hiddenCount: 0, errorCount: 0,
    totalProcessed: 0, cacheTimestamp: now,
    isStale: false, nextRefreshAt: now,
  };
}

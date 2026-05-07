/**
 * ============================================================
 * COMPOSITE ENGINE v3.0
 * ============================================================
 * server/engine/compositeEngineV3.ts
 *
 * True 6-layer weighted composite replacing the additive modifier chain.
 * Fully synchronous — reads only from in-memory caches, no I/O.
 *
 * WEIGHTS (re-normalised when a layer has no data):
 *   Bandarmology:      25%
 *   News Intelligence: 25%
 *   Fundamental:       20%
 *   Management:        15%
 *   Valuation:         10%
 *   Macro/Sector:       5%
 *
 * BUCKET THRESHOLDS (composite score 0-100):
 *   >= 70  →  siap_dipantau      ("Siap Dipantau")
 *   >= 40  →  watchlist_prioritas ("Watchlist Prioritas")
 *   <  40  →  hindari_dulu       ("Hindari Dulu")
 *
 * HARD OVERRIDES (evaluated BEFORE composite, in priority order):
 *   1. isGorengan          → score = 0, hindari_dulu
 *   2. Management CRITICAL → score = 0, hindari_dulu
 *   3. Macro hard override → compositeScore capped at 40
 *
 * NULL LAYER RULE:
 *   Layers with no cached data return score = null.
 *   Null layers are excluded from both numerator and denominator
 *   so the remaining weights re-normalise automatically.
 *   Bandarmology is always present (never null).
 * ============================================================
 */

import { computeValuation }          from './valuationEngine';
import { getNewsModifier }            from './newsRouter';
import { getCachedManagementResult }  from './managementScorer';
import { getCachedMacroContext }      from './macroContext';

// ── Types ─────────────────────────────────────────────────────

export interface CompositeV3Input {
  symbol:            string;
  sector:            string | null;
  bandarmologyScore: number;        // getStockDecision().readiness (0-100)
  isGorengan:        boolean;
  peRatio:           number | null;
  dividendYield:     number | null;
  roe:               number | null;
  netMargin:         number | null;
}

export interface LayerResult {
  score:  number | null;  // null = no data; excluded from denominator
  weight: number;         // nominal weight (e.g. 0.25)
}

export interface CompositeV3Result {
  compositeScore:  number;                                               // 0-100
  homepageBucket:  'siap_dipantau' | 'watchlist_prioritas' | 'hindari_dulu';
  actionGuidance:  string;
  actionColor:     'green' | 'yellow' | 'red';
  actionState:     'SIAP_DIPANTAU' | 'WATCHLIST_PRIORITAS' | 'HINDARI_DULU';
  hardOverride:    'GORENGAN' | 'MANAGEMENT_CRITICAL' | null;
  macroHardCap:    boolean;
  activeWeightSum: number;
  layers: {
    bandarmology:     LayerResult;
    newsIntelligence: LayerResult;
    fundamental:      LayerResult;
    management:       LayerResult;
    valuation:        LayerResult;
    macroSector:      LayerResult;
  };
}

// ── Weights ───────────────────────────────────────────────────

const W = {
  bandarmology:     0.25,
  newsIntelligence: 0.25,
  fundamental:      0.20,
  management:       0.15,
  valuation:        0.10,
  macroSector:      0.05,
} as const;

// ── Layer scorers ─────────────────────────────────────────────

function scoreBandarmology(score: number): LayerResult {
  return { score: Math.max(0, Math.min(100, Math.round(score))), weight: W.bandarmology };
}

function scoreNews(
  symbol: string,
  sector: string | null
): { layer: LayerResult; macroOverride: boolean } {
  try {
    const nm = getNewsModifier(symbol, sector ?? '');
    const hasData = nm.modifier !== 0 || nm.macroOverride || nm.context.length > 0;
    if (!hasData) return { layer: { score: null, weight: W.newsIntelligence }, macroOverride: false };
    // Map modifier ±15 to score 0-100 centred on 50
    const score = Math.max(0, Math.min(100, Math.round(50 + nm.modifier * (50 / 15))));
    return { layer: { score, weight: W.newsIntelligence }, macroOverride: nm.macroOverride };
  } catch {
    return { layer: { score: null, weight: W.newsIntelligence }, macroOverride: false };
  }
}

function scoreValuationLayers(
  peRatio:       number | null,
  dividendYield: number | null,
  roe:           number | null,
  netMargin:     number | null,
  sector:        string | null
): { fundamental: LayerResult; valuation: LayerResult } {
  const out = computeValuation({ peRatio, dividendYield, roe, netMargin, sector });

  // Fundamental: quality score is already 0-100 (high = better fundamentals)
  const fundamentalScore = out.quality.label === 'TIDAK_ADA_DATA'
    ? null
    : Math.round(out.quality.score);

  // Valuation: invert so MURAH (cheap) = high score, MAHAL (expensive) = low score
  // Floor of 30 for MAHAL: expensive stocks still contribute, not penalised to 0
  const valuationScore = out.valuation.label === 'TIDAK_ADA_DATA'
    ? null
    : Math.max(30, Math.min(100, Math.round(100 - out.valuation.score)));

  return {
    fundamental: { score: fundamentalScore, weight: W.fundamental },
    valuation:   { score: valuationScore,   weight: W.valuation   },
  };
}

function scoreMgmt(
  symbol: string
): { layer: LayerResult; criticalFlag: boolean } {
  try {
    const cached = getCachedManagementResult(symbol);
    if (!cached) return { layer: { score: null, weight: W.management }, criticalFlag: false };
    if (cached.hasCriticalRedFlag) {
      return { layer: { score: 0, weight: W.management }, criticalFlag: true };
    }
    return { layer: { score: cached.compositeScore, weight: W.management }, criticalFlag: false };
  } catch {
    return { layer: { score: null, weight: W.management }, criticalFlag: false };
  }
}

function scoreMacro(sector: string | null): LayerResult {
  if (!sector) return { score: null, weight: W.macroSector };
  const macro = getCachedMacroContext();
  if (!macro) return { score: null, weight: W.macroSector };

  const relevant = macro.signals.filter(s => s.sector === sector || s.sector === 'ALL');
  if (relevant.length === 0) return { score: null, weight: W.macroSector };

  const strengthMap = { KUAT: 2, SEDANG: 1, LEMAH: 0.5 } as const;
  const net = relevant.reduce((acc, s) => {
    const w = strengthMap[s.strength as keyof typeof strengthMap] ?? 1;
    return s.effect === 'POSITIF' ? acc + w : s.effect === 'NEGATIF' ? acc - w : acc;
  }, 0);

  return { score: Math.max(0, Math.min(100, Math.round(50 + net * 10))), weight: W.macroSector };
}

// ── Result builder ────────────────────────────────────────────

function buildResult(
  compositeScore:  number,
  hardOverride:    CompositeV3Result['hardOverride'],
  macroHardCap:    boolean,
  layers:          CompositeV3Result['layers'],
  activeWeightSum: number,
): CompositeV3Result {
  const bucket: CompositeV3Result['homepageBucket'] =
    compositeScore >= 70 ? 'siap_dipantau' :
    compositeScore >= 40 ? 'watchlist_prioritas' :
    'hindari_dulu';

  const actionGuidance =
    bucket === 'siap_dipantau'      ? 'Siap Dipantau' :
    bucket === 'watchlist_prioritas' ? 'Watchlist Prioritas' :
    'Hindari Dulu';

  const actionColor: CompositeV3Result['actionColor'] =
    bucket === 'siap_dipantau' ? 'green' :
    bucket === 'watchlist_prioritas' ? 'yellow' : 'red';

  const actionState: CompositeV3Result['actionState'] =
    bucket === 'siap_dipantau'       ? 'SIAP_DIPANTAU' :
    bucket === 'watchlist_prioritas' ? 'WATCHLIST_PRIORITAS' :
    'HINDARI_DULU';

  return {
    compositeScore, homepageBucket: bucket,
    actionGuidance, actionColor, actionState,
    hardOverride, macroHardCap, activeWeightSum, layers,
  };
}

// ── Public API ────────────────────────────────────────────────

export function computeCompositeV3(input: CompositeV3Input): CompositeV3Result {
  const { symbol, sector, bandarmologyScore, isGorengan,
          peRatio, dividendYield, roe, netMargin } = input;

  // Compute all layers (for transparency even in override cases)
  const bandarmologyLayer                = scoreBandarmology(bandarmologyScore);
  const { layer: newsLayer, macroOverride } = scoreNews(symbol, sector);
  const { fundamental: fundamentalLayer,
          valuation:   valuationLayer   } = scoreValuationLayers(peRatio, dividendYield, roe, netMargin, sector);
  const { layer: mgmtLayer, criticalFlag } = scoreMgmt(symbol);
  const macroSectorLayer                 = scoreMacro(sector);

  const allLayers = {
    bandarmology:     bandarmologyLayer,
    newsIntelligence: newsLayer,
    fundamental:      fundamentalLayer,
    management:       mgmtLayer,
    valuation:        valuationLayer,
    macroSector:      macroSectorLayer,
  };

  // Hard override 1: Gorengan
  if (isGorengan) {
    return buildResult(0, 'GORENGAN', false, allLayers, 0);
  }

  // Hard override 2: Management CRITICAL red flag
  if (criticalFlag) {
    return buildResult(0, 'MANAGEMENT_CRITICAL', false, allLayers, 0);
  }

  // Weighted composite (null layers excluded from denominator)
  let weightedSum    = 0;
  let activeWeightSum = 0;

  for (const layer of Object.values(allLayers)) {
    if (layer.score !== null) {
      weightedSum     += layer.score * layer.weight;
      activeWeightSum += layer.weight;
    }
  }

  let compositeScore = activeWeightSum > 0
    ? Math.round(weightedSum / activeWeightSum)
    : 0;
  compositeScore = Math.max(0, Math.min(100, compositeScore));

  // Bandarmology hard floor: active distribution cannot be rescued by fundamentals
  // Cap = bandarmologyScore + 15 to scale with how weak the bando signal is
  if (bandarmologyScore < 35) {
    const bandoCap = Math.min(45, bandarmologyScore + 15);
    if (compositeScore > bandoCap) compositeScore = bandoCap;
  }

  // Hard override 3: Macro hard cap at 40
  const macroHardCap = macroOverride && compositeScore > 40;
  if (macroHardCap) compositeScore = 40;

  return buildResult(compositeScore, null, macroHardCap, allLayers, activeWeightSum);
}

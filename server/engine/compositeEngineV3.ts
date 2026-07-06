/**
 * ============================================================
 * COMPOSITE ENGINE v3.3
 * ============================================================
 * server/engine/compositeEngineV3.ts
 *
 * True 7-layer weighted composite replacing the additive modifier chain.
 * Fully synchronous — reads only from in-memory caches, no I/O.
 *
 * WEIGHTS v3.3 (re-normalised when a layer has no data):
 *   Bandarmology:      25%
 *   News Intelligence: 22%
 *   Fundamental:       20%
 *   Management:        13%
 *   Insider Activity:   8%
 *   Valuation:         10%
 *   Macro/Sector:       2%
 *
 * MACRO REGIME MULTIPLIER (v3.3 — applied to Layer 1 before composite):
 *   CAPITAL_FLIGHT:        bandarmology × 0.60, composite hard-capped at 50
 *   CAPITAL_OUTFLOW:       bandarmology × 0.75
 *   CAPITAL_INFLOW:        bandarmology × 1.15
 *   NEUTRAL / INSUFFICIENT_DATA: × 1.0 (no effect)
 *
 * BUCKET THRESHOLDS (composite score 0-100):
 *   >= 70  →  siap_dipantau      ("Siap Dipantau")
 *   >= 40  →  watchlist_prioritas ("Watchlist Prioritas")
 *   <  40  →  hindari_dulu       ("Hindari Dulu")
 *
 * HARD OVERRIDES (evaluated in priority order):
 *   1. isGorengan          → score = 0, hindari_dulu
 *   2. Management CRITICAL → score = 0, hindari_dulu
 *   3. CAPITAL_FLIGHT      → compositeScore capped at 50, flag MACRO_CAPITAL_FLIGHT
 *   4. Macro news override → compositeScore capped at 40
 *
 * NULL LAYER RULE:
 *   Layers with no cached data return score = null.
 *   Null layers are excluded from both numerator and denominator
 *   so the remaining weights re-normalise automatically.
 *   Bandarmology is always present (never null).
 *   INSUFFICIENT_DATA insider signal → score = null (excluded, not treated as 50).
 * ============================================================
 */

import { computeValuation }          from './valuationEngine';
import { getNewsModifier }            from './newsRouter';
import { getCachedManagementResult }  from './managementScorer';
import { getCachedMacroContext }      from './macroContext';
import { getCachedInsiderScore }      from './insiderScorer';
import { getCachedMacroRegime, type MacroRegime } from './macroRegimeDetector';

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
  /** Optional scores from bandarmologyExtensions v3.1. When present, layer gating rules apply. */
  extensionScores?: {
    m17Score:   number | null;  // smart/dumb divergence (0-100)
    m18GapPct:  number | null;  // top-broker avg buy gap in % (raw, not normalised)
    m24Score:   number | null;  // raw distribution detection score (0-100, NOT inverted)
  } | null;
  /** Optional: inject a mock MacroRegime for testing. Production reads the in-memory cache. */
  mockRegime?: MacroRegime;
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
  /**
   * Layer gating flags from v3.1/v3.2/v3.3 extension rules.
   * Empty array when no extension scores are provided.
   *   PUMP_WARNING                     — high bando + weak fundamentals
   *   SMART_MONEY_EXIT                 — M17 < 35, fundamental/valuation boost capped
   *   DISTRIBUTION_CAPACITY_BUILT      — M18 gap > 40%, −10 penalty applied
   *   INSIDER_CLUSTER_BUY              — cluster buy (price context null/unavailable), +5 boost
   *   INSIDER_CLUSTER_BUYING_WEAKNESS  — cluster buy + confirmed price weakness, +8 boost
   *   INSIDER_EXIT_DURING_ACCUMULATION — strong insider sell + high bando, −12 penalty
   *   MACRO_CAPITAL_FLIGHT             — structural foreign outflow, composite capped at 50
   */
  activeFlags: string[];
  macroRegime: { regime: string; multiplier: number; triggers: string[]; note: string };
  layers: {
    bandarmology:     LayerResult;
    newsIntelligence: LayerResult;
    fundamental:      LayerResult;
    management:       LayerResult;
    insiderActivity:  LayerResult;
    valuation:        LayerResult;
    macroSector:      LayerResult;
  };
}

// ── Weights ───────────────────────────────────────────────────

const W = {
  bandarmology:     0.25,
  newsIntelligence: 0.22,
  fundamental:      0.20,
  management:       0.13,
  insiderActivity:  0.08,
  valuation:        0.10,
  macroSector:      0.02,
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

function scoreInsiderActivity(
  symbol: string
): { layer: LayerResult; clusterBuy: boolean; priceContext: boolean | null; strongSell: boolean; filingDelayFlag: boolean } {
  const noData = { layer: { score: null, weight: W.insiderActivity }, clusterBuy: false, priceContext: null, strongSell: false, filingDelayFlag: false };
  try {
    const cached = getCachedInsiderScore(symbol);
    if (!cached) return noData;
    if (cached.signal === 'INSUFFICIENT_DATA' || cached.score === null) return noData;
    return {
      layer:          { score: cached.score, weight: W.insiderActivity },
      clusterBuy:     cached.clusterBuySignal,
      priceContext:   cached.priceContextSignal,
      strongSell:     cached.signal === 'STRONG_SELL',
      filingDelayFlag:cached.filingDelayFlag,
    };
  } catch {
    return noData;
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
  activeFlags:     string[] = [],
  regime:          MacroRegime = getCachedMacroRegime(),
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
    hardOverride, macroHardCap, activeWeightSum,
    activeFlags,
    macroRegime: { regime: regime.regime, multiplier: regime.multiplier, triggers: regime.triggers, note: regime.note },
    layers,
  };
}

// ── Public API ────────────────────────────────────────────────

export function computeCompositeV3(input: CompositeV3Input): CompositeV3Result {
  const { symbol, sector, bandarmologyScore, isGorengan,
          peRatio, dividendYield, roe, netMargin } = input;

  // Macro regime: multiplier applied to Layer 1 (Bandarmology) before composite.
  // mockRegime is for test injection only; production uses the in-memory cache.
  const regime = input.mockRegime ?? getCachedMacroRegime();
  const effectiveBandoScore = Math.max(0, Math.min(100, Math.round(bandarmologyScore * regime.multiplier)));

  // Compute all layers (for transparency even in override cases)
  const bandarmologyLayer                = scoreBandarmology(effectiveBandoScore);
  const { layer: newsLayer, macroOverride } = scoreNews(symbol, sector);
  const { fundamental: fundamentalLayer,
          valuation:   valuationLayer   } = scoreValuationLayers(peRatio, dividendYield, roe, netMargin, sector);
  const { layer: mgmtLayer, criticalFlag } = scoreMgmt(symbol);
  const { layer: insiderLayer, clusterBuy, priceContext, strongSell, filingDelayFlag } = scoreInsiderActivity(symbol);
  const macroSectorLayer                 = scoreMacro(sector);

  const allLayers = {
    bandarmology:     bandarmologyLayer,
    newsIntelligence: newsLayer,
    fundamental:      fundamentalLayer,
    management:       mgmtLayer,
    insiderActivity:  insiderLayer,
    valuation:        valuationLayer,
    macroSector:      macroSectorLayer,
  };

  // Hard override 1: Gorengan
  if (isGorengan) {
    return buildResult(0, 'GORENGAN', false, allLayers, 0, [], regime);
  }

  // Hard override 2: Management CRITICAL red flag
  if (criticalFlag) {
    return buildResult(0, 'MANAGEMENT_CRITICAL', false, allLayers, 0, [], regime);
  }

  // ── Layer gating: v3.1 extension rules ───────────────────────
  // Applied BEFORE composite computation so they affect the weighted average.
  const activeFlags: string[] = [];
  const ext = input.extensionScores ?? null;

  // RULE 2: M17 < 35 → smart money is exiting.
  // Cap fundamental and valuation layers at neutral (50) so they cannot rescue the score.
  let effectiveLayers = { ...allLayers };
  if (ext?.m17Score !== null && ext?.m17Score !== undefined && ext.m17Score < 35) {
    effectiveLayers = {
      ...effectiveLayers,
      fundamental: {
        ...effectiveLayers.fundamental,
        score: effectiveLayers.fundamental.score !== null
          ? Math.min(50, effectiveLayers.fundamental.score)
          : null,
      },
      valuation: {
        ...effectiveLayers.valuation,
        score: effectiveLayers.valuation.score !== null
          ? Math.min(50, effectiveLayers.valuation.score)
          : null,
      },
    };
    activeFlags.push('SMART_MONEY_EXIT');
  }

  // Weighted composite (null layers excluded from denominator)
  let weightedSum    = 0;
  let activeWeightSum = 0;

  for (const layer of Object.values(effectiveLayers)) {
    if (layer.score !== null) {
      weightedSum     += layer.score * layer.weight;
      activeWeightSum += layer.weight;
    }
  }

  let compositeScore = activeWeightSum > 0
    ? Math.round(weightedSum / activeWeightSum)
    : 0;
  compositeScore = Math.max(0, Math.min(100, compositeScore));

  // RULE 1: PUMP_WARNING — high bandarmology + weak fundamentals
  // Bando signal may be artificial; cap composite at 50.
  const fundamentalScore = effectiveLayers.fundamental.score;
  if (bandarmologyScore > 65 && fundamentalScore !== null && fundamentalScore < 40) {
    if (compositeScore > 50) compositeScore = 50;
    activeFlags.push('PUMP_WARNING');
  }

  // Bandarmology hard floor: active distribution cannot be rescued by fundamentals
  // Cap = bandarmologyScore + 15 to scale with how weak the bando signal is
  if (bandarmologyScore < 35) {
    const bandoCap = Math.min(45, bandarmologyScore + 15);
    if (compositeScore > bandoCap) compositeScore = bandoCap;
  }

  // RULE 3: DISTRIBUTION_CAPACITY_BUILT — M18 gap > 40% → −10 penalty
  if (ext?.m18GapPct !== null && ext?.m18GapPct !== undefined && ext.m18GapPct > 40) {
    compositeScore = Math.max(0, compositeScore - 10);
    activeFlags.push('DISTRIBUTION_CAPACITY_BUILT');
  }

  // RULE 5a: cluster buy + confirmed price weakness → +8 (highest conviction)
  // RULE 5b: cluster buy alone (price context null/unavailable) → +5
  // Decoupled because POJK 4/2024 encourages same-day filing; priceContextSignal
  // rarely fires even when conviction is real (proxy can't measure same-day delta).
  if (clusterBuy && priceContext === true) {
    compositeScore = Math.min(100, compositeScore + 8);
    activeFlags.push('INSIDER_CLUSTER_BUYING_WEAKNESS');
  } else if (clusterBuy && priceContext !== true) {
    compositeScore = Math.min(100, compositeScore + 5);
    activeFlags.push('INSIDER_CLUSTER_BUY');
  }

  // RULE 6: INSIDER_EXIT_DURING_ACCUMULATION — strong insider sell + high bando → −12 penalty
  // Insiders exiting while bandar appears to accumulate = distribution setup.
  if (strongSell && bandarmologyScore > 55) {
    compositeScore = Math.max(0, compositeScore - 12);
    activeFlags.push('INSIDER_EXIT_DURING_ACCUMULATION');
  }

  // Hard override 3: CAPITAL_FLIGHT — structural outflow caps composite at 50
  if (regime.regime === 'CAPITAL_FLIGHT' && compositeScore > 50) {
    compositeScore = 50;
    activeFlags.push('MACRO_CAPITAL_FLIGHT');
  }

  // Hard override 4: Macro news hard cap at 40 (more restrictive, applied after CAPITAL_FLIGHT)
  const macroHardCap = macroOverride && compositeScore > 40;
  if (macroHardCap) compositeScore = 40;

  return buildResult(compositeScore, null, macroHardCap, allLayers, activeWeightSum, activeFlags, regime);
}

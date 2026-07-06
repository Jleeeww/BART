/**
 * ============================================================
 * BANDARMOLOGY EXTENSIONS v3.1
 * ============================================================
 * server/engine/bandarmologyExtensions.ts
 *
 * Adds M17, M18, M24 to the bandarmology engine WITHOUT
 * modifying bandarmologyCore.ts (constraint: non-invasive).
 *
 * DESIGN:
 *   computeBandarmologyV3Extended() wraps computeBandarmologyV2(),
 *   computes the three new models, then re-runs the composite
 *   with the v3.1 weight table.
 *
 * NEW MODEL INVENTORY:
 *   M17 — Smart/Dumb Money Divergence      weight: 0.12
 *   M18 — Top-Broker Avg Price Position    weight: 0.06
 *   M24 — Distribution Detector            weight: 0.06 (inverted)
 *
 * WEIGHT TABLE v3.1 (sub-composite, renormalised over active models):
 *   M6:  11%   M17: 12%   M1:  10%   M3:  8%    M8:  8%
 *   M12:  6%   M24:  6%   M2:   5%   M18:  6%   M14: 5%
 *   M11:  4%   M7:   3%   M15:  3%
 *   M9: penalty (unchanged)   M16: regime modifier (unchanged)
 *
 * CALIBRATION CONTRACT:
 *   BBCA composite: 50–60  (watchlist_prioritas)
 *   UNVR composite: 15–25  (hindari_dulu)
 * ============================================================
 */

import {
  clamp,
  safe_normalize,
  safe_div,
  getLiquidityTier,
  parseIDR,
  computeComposite,
  computeBandarmologyV2,
} from './bandarmologyCore';

import type {
  BandarmologyInput,
  BandarmologyV2Result,
  ModelScore,
  MaturityLabel,
} from './bandarmologyCore';

import {
  classifyBrokers,
} from './brokerRegistry';

import type { BrokerRecord } from './bandarmologyCore';

// ── Public re-export so callers can use one import ───────────
export type { BandarmologyV2Result };

// ── M18 session snapshot type ─────────────────────────────────

/**
 * Aggregate of a single broker's activity over a 60-session window.
 * The pipeline should compute this from the sessionHistory table.
 */
export interface BrokerSessionAggregate {
  code: string;
  cumNetBuyIDR: number;    // cumulative net buy in IDR (positive = net buyer)
  totalBuyValue: number;   // sum of all IDR buy value over window
  totalBuyVolume: number;  // sum of all share volume bought over window
}

/** Extended input for the v3 bandarmology engine. */
export interface BandarmologyV3Input extends BandarmologyInput {
  /** 60-session broker aggregates, oldest→newest. Null = not available. */
  brokerSessionHistory?: BrokerSessionAggregate[] | null;
  /** Current mid-price for M18 gap computation. */
  currentPrice?: number | null;
  /** Last 5 M17 scores (oldest→newest) for M24 persistence. Null = use current M17. */
  m17History?: (number | null)[] | null;
}

// ── Types ──────────────────────────────────────────────────────

export interface M17Output extends ModelScore {
  smartNet: number | null;
  dumbNet: number | null;
  divergence: number | null;
}

export interface M18Output extends ModelScore {
  gapPct: number | null;          // % gap between current price and top-broker avg buy
  topBrokerAvgBuy: number | null; // IDR
  dataQuality: 'FULL' | 'PARTIAL' | 'NONE';
}

export interface M24Output extends ModelScore {
  detectionScore: number;         // raw distribution detection strength 0-100
  sellingPersistence: number;
  retailAbsorption: number;
  m14ExtendedFlag: number;
  m18GapContrib: number;
  negativeM15: number;
}

export interface BandarmologyV3Result extends BandarmologyV2Result {
  M17_smartDumbDivergence: M17Output;
  M18_topBrokerPricePosition: M18Output;
  M24_distributionDetector: M24Output;
  v3Composite: {
    score: number | null;
    rawScore: number | null;
    regimeModifier: number;
    riskPenalty: number;
    confidence: number;
    activeModels: number;
  };
}

// ============================================================
// M17 — Smart/Dumb Money Divergence
// ============================================================

/**
 * M17 — Smart/Dumb Money Divergence
 *
 * Splits net flow into smart money (institutional) vs dumb money (retail)
 * using the broker registry. Divergence in opposite directions is the
 * strongest signal that informed money is on the other side of retail.
 *
 * FORMULA:
 *   smartNet = sum(net) for SMART_FOREIGN + SMART_LOCAL brokers
 *   dumbNet  = sum(net) for RETAIL_RAIL brokers
 *   divergence = (smartNet - dumbNet) / avg20dValue   range: [-∞, +∞]
 *   score = safe_normalize(divergence, -1.0, 1.0)     range: [0, 100]
 *
 * CALIBRATION: divergence = 0 → score = 50 (true neutral)
 *   Smart buys 50B + retail sells 50B on 200B avg day:
 *     divergence = (50B - (-50B)) / 200B = 0.5 → score = 75
 */
export function computeM17(
  brokers: BrokerRecord[],
  avg20dValue: number | null
): M17Output {
  const WEIGHT = 0.12;
  const NULL_OUT: M17Output = {
    score: null, isReliable: false, weight: WEIGHT,
    smartNet: null, dumbNet: null, divergence: null,
    note: 'M17: insufficient data',
  };

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { ...NULL_OUT, note: 'M17: tier 4 — below liquidity floor' };
  }
  if (!brokers || brokers.length === 0) {
    return { ...NULL_OUT, note: 'M17: no broker data' };
  }

  // Parse and classify
  const parsed = brokers.map((b) => {
    const netBuy  = parseIDR(b.netBuyRaw);
    const netSell = parseIDR(b.netSellRaw);
    return { code: b.code, net: netBuy - netSell };
  });

  const { smart, retail } = classifyBrokers(parsed);

  const smartNet = smart.reduce((s, b) => s + b.net, 0);
  const dumbNet  = retail.reduce((s, b) => s + b.net, 0);

  if (smart.length === 0 && retail.length === 0) {
    return { ...NULL_OUT, note: 'M17: no classified brokers in registry' };
  }

  const divergence = safe_div(smartNet - dumbNet, avg20dValue ?? 0);
  if (divergence === null) {
    return { ...NULL_OUT, smartNet, dumbNet, note: 'M17: avg20dValue zero/null' };
  }

  const score = safe_normalize(divergence, -1.0, 1.0);

  return {
    score,
    isReliable: liq.isReliable,
    weight: WEIGHT,
    smartNet,
    dumbNet,
    divergence,
  };
}

// ============================================================
// M18 — Top-Broker Avg Price Position
// ============================================================

/**
 * M18 — Top-Broker Avg Price Position
 *
 * Estimates how far the current price has moved above the average cost
 * basis of the top institutional accumulators. Large gaps signal that
 * early accumulators have built "distribution capacity" (can sell and
 * still profit), creating supply overhead risk.
 *
 * FORMULA:
 *   For each top-5 broker by 60d cumulative net buy:
 *     avgBuyPrice = totalBuyValue / totalBuyVolume
 *     gap_i = (currentPrice - avgBuyPrice) / avgBuyPrice × 100
 *   aggregateGap = weightedAvg(gap_i, weight = cumNetBuyIDR_i)
 *
 * SCORE TABLE (inverted: high gap = risky = lower score):
 *   gap < 5%:   80  (early accumulation, cost basis fresh)
 *   gap 5-20%:  65  (mid-cycle, room to run)
 *   gap 20-40%: 40  (ripening, watch closely)
 *   gap > 40%:  15  (distribution capacity built)
 *
 * Returns null when fewer than 2 qualified brokers or no current price.
 */
export function computeM18(
  brokerHistory: BrokerSessionAggregate[] | null | undefined,
  currentPrice: number | null | undefined,
  avg20dValue: number | null
): M18Output {
  const WEIGHT = 0.06;
  const NULL_OUT: M18Output = {
    score: null, isReliable: false, weight: WEIGHT,
    gapPct: null, topBrokerAvgBuy: null, dataQuality: 'NONE',
    note: 'M18: insufficient data',
  };

  if (!brokerHistory || brokerHistory.length < 2) {
    return NULL_OUT;
  }
  if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
    return { ...NULL_OUT, note: 'M18: invalid current price' };
  }

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { ...NULL_OUT, note: 'M18: tier 4' };
  }

  // Filter to net buyers and classify as smart money
  const netBuyers = brokerHistory
    .filter((b) => b.cumNetBuyIDR > 0 && b.totalBuyVolume > 0)
    .sort((a, b) => b.cumNetBuyIDR - a.cumNetBuyIDR)
    .slice(0, 5);

  if (netBuyers.length < 2) {
    return { ...NULL_OUT, note: 'M18: fewer than 2 net-buying brokers' };
  }

  // Compute weighted avg buy price and gap per broker
  let weightedGapNumerator = 0;
  let weightedGapDenominator = 0;
  let topBrokerAvgBuy: number | null = null;

  for (const b of netBuyers) {
    if (b.totalBuyValue <= 0 || b.totalBuyVolume <= 0) continue;
    const avgBuyPrice = b.totalBuyValue / b.totalBuyVolume;
    if (avgBuyPrice <= 0) continue;

    const gapPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
    const w = b.cumNetBuyIDR;

    weightedGapNumerator += gapPct * w;
    weightedGapDenominator += w;

    if (topBrokerAvgBuy === null) topBrokerAvgBuy = avgBuyPrice; // top broker by cumNetBuy
  }

  if (weightedGapDenominator <= 0) {
    return { ...NULL_OUT, note: 'M18: zero denominator in gap calc' };
  }

  const aggregateGap = weightedGapNumerator / weightedGapDenominator;

  // Score table: high gap = risky = lower score
  let score: number;
  if (aggregateGap < 5)       score = 80;
  else if (aggregateGap < 20) score = 65;
  else if (aggregateGap < 40) score = 40;
  else                         score = 15;

  const dataQuality: M18Output['dataQuality'] =
    netBuyers.length >= 4 ? 'FULL' : 'PARTIAL';

  return {
    score,
    isReliable: liq.isReliable,
    weight: WEIGHT,
    gapPct: Number(aggregateGap.toFixed(2)),
    topBrokerAvgBuy,
    dataQuality,
  };
}

// ============================================================
// M24 — Distribution Detector
// ============================================================

/**
 * M24 — Distribution Detector
 *
 * Composite early-warning model that fires when multiple independent
 * signals converge on active distribution. Score > 65 forces the
 * DistributionWarning system to BAHAYA regardless of condition counter.
 *
 * FORMULA:
 *   detectionScore =
 *     0.30 × sellingPersistence   (5-session M17 inverse)
 *     0.20 × retailAbsorption     (retail net buy when smart sells)
 *     0.20 × m14ExtendedFlag      (M14 EXTENDED = 100, else 0)
 *     0.15 × m18GapContrib        (high gap = high contrib)
 *     0.15 × negativeM15          (price falling on low flow)
 *
 * COMPOSITE ENTRY: score is INVERTED (100 - detectionScore) so that
 * a high detection score pulls the bandarmology composite DOWN.
 * This correctly penalises distribution risk within the composite.
 */
export function computeM24(
  m17: M17Output,
  m18: M18Output,
  m14Score: number | null,
  m14Maturity: MaturityLabel | null,
  m15Score: number | null,
  brokers: BrokerRecord[],
  avg20dValue: number | null,
  m17History?: (number | null)[] | null
): M24Output {
  const WEIGHT = 0.06;

  // ── Signal 1: Smart-money selling persistence (0-100) ──────
  // Use last 5 M17 scores if available; otherwise proxy from current M17.
  let sellingPersistence: number;
  const m17hist = (m17History ?? [])
    .filter((v): v is number => v !== null && !isNaN(v) && isFinite(v));

  if (m17hist.length >= 2) {
    // Fraction of sessions where M17 < 35 (smart money exiting) — inverted to 0-100
    const exitSessions = m17hist.slice(-5).filter((v) => v < 35).length;
    const total = Math.min(m17hist.length, 5);
    sellingPersistence = clamp((exitSessions / total) * 100);
  } else {
    // Single session proxy: if M17 is low, assume selling
    const m17s = m17.score ?? 50;
    sellingPersistence = m17s < 35 ? 100 : m17s < 45 ? 60 : m17s < 50 ? 20 : 0;
  }

  // ── Signal 2: Retail absorption (0-100) ────────────────────
  // High retail absorption = retail is buying while smart is selling.
  // Retail net buy > 0 AND smart money exiting → high signal.
  let retailAbsorption = 0;
  if (brokers.length > 0 && avg20dValue && avg20dValue > 0) {
    const parsed = brokers.map((b) => ({
      code: b.code,
      net: parseIDR(b.netBuyRaw) - parseIDR(b.netSellRaw),
    }));
    const { retail } = classifyBrokers(parsed);
    const retailNet = retail.reduce((s, b) => s + b.net, 0);
    const smartSelling = (m17.score ?? 50) < 50;

    if (smartSelling && retailNet > 0) {
      const ratio = safe_div(retailNet, avg20dValue) ?? 0;
      retailAbsorption = clamp(safe_normalize(ratio, 0, 0.5));
    }
  }

  // ── Signal 3: M14 EXTENDED status (0 or 100) ───────────────
  const m14ExtendedFlag = m14Maturity === 'EXTENDED' ? 100 : 0;

  // ── Signal 4: M18 high gap contribution (0-100) ────────────
  let m18GapContrib = 0;
  if (m18.gapPct !== null) {
    // Gap > 40%: max signal; gap 0-5%: no signal
    m18GapContrib = clamp(safe_normalize(m18.gapPct, 5, 50));
  }

  // ── Signal 5: Negative M15 — price falling on low flow ─────
  let negativeM15 = 0;
  if (m15Score !== null) {
    // M15 < 40 → distribution-like absorption; invert for detection
    negativeM15 = m15Score < 40 ? clamp(safe_normalize(40 - m15Score, 0, 40)) : 0;
  }

  // ── Composite detection score ───────────────────────────────
  const detectionScore = clamp(
    0.30 * sellingPersistence +
    0.20 * retailAbsorption  +
    0.20 * m14ExtendedFlag   +
    0.15 * m18GapContrib     +
    0.15 * negativeM15
  );

  // INVERT for composite contribution: high detection = low score = drags composite down
  const compositeScore = clamp(100 - detectionScore);

  const liq = getLiquidityTier(avg20dValue);

  return {
    score: compositeScore,
    isReliable: liq.isValid,
    weight: WEIGHT,
    detectionScore: Number(detectionScore.toFixed(2)),
    sellingPersistence: Number(sellingPersistence.toFixed(2)),
    retailAbsorption: Number(retailAbsorption.toFixed(2)),
    m14ExtendedFlag,
    m18GapContrib: Number(m18GapContrib.toFixed(2)),
    negativeM15: Number(negativeM15.toFixed(2)),
  };
}

// ============================================================
// V3.1 COMPOSITE — Re-weights existing models + wires M17/M18/M24
// ============================================================

/**
 * computeBandarmologyV3Extended
 *
 * Wraps computeBandarmologyV2(), computes M17/M18/M24, then re-runs
 * the sub-composite with v3.1 weight table. The v2 model scores are
 * read from the result and re-used with new weights — no re-computation.
 *
 * Callers should use v3Composite.score as the bandarmologyScore input
 * to computeCompositeV3() when available.
 */
export function computeBandarmologyV3Extended(
  input: BandarmologyV3Input
): BandarmologyV3Result {
  // ── Phase 0: Run v2 engine (all M1-M16 models) ─────────────
  const v2 = computeBandarmologyV2(input);

  const avg20dValue = input.volume.avg20dValue;

  // ── Phase 1: New models ─────────────────────────────────────
  const M17 = computeM17(input.brokers, avg20dValue);

  const M18 = computeM18(
    input.brokerSessionHistory ?? null,
    input.currentPrice ?? null,
    avg20dValue
  );

  const M24 = computeM24(
    M17,
    M18,
    v2.M14_campaignDuration.score,
    v2.M14_campaignDuration.maturity,
    v2.M15_priceElasticity.score,
    input.brokers,
    avg20dValue,
    input.m17History ?? null
  );

  // ── Phase 2: Re-composite with v3.1 weights ─────────────────
  // Reads model scores from v2 result; only the WEIGHTS change.
  const compositeModels = [
    { id: 'M1',  score: v2.M1_accumulationStrength.score,         weight: 0.10, isReliable: v2.M1_accumulationStrength.isReliable  },
    { id: 'M2',  score: v2.M2_absorptionScore.score,              weight: 0.05, isReliable: v2.M2_absorptionScore.isReliable       },
    { id: 'M3',  score: v2.M3_brokerDominance.score,              weight: 0.08, isReliable: v2.M3_brokerDominance.isReliable       },
    { id: 'M6',  score: v2.M6_flowNormalized.score,               weight: 0.11, isReliable: v2.M6_flowNormalized.isReliable        },
    { id: 'M7',  score: v2.M7_brokerRotation.score,               weight: 0.03, isReliable: v2.M7_brokerRotation.isReliable        },
    { id: 'M8',  score: v2.M8_stealthAccumulation.score,          weight: 0.08, isReliable: v2.M8_stealthAccumulation.isReliable   },
    { id: 'M11', score: v2.M11_flowDecomposition.compositeScore,  weight: 0.04, isReliable: v2.M11_flowDecomposition.isReliable    },
    { id: 'M12', score: v2.M12_rollingAccumulation.score,         weight: 0.06, isReliable: v2.M12_rollingAccumulation.isReliable  },
    { id: 'M14', score: v2.M14_campaignDuration.score,            weight: 0.05, isReliable: v2.M14_campaignDuration.isReliable     },
    { id: 'M15', score: v2.M15_priceElasticity.score,             weight: 0.03, isReliable: v2.M15_priceElasticity.isReliable      },
    { id: 'M17', score: M17.score,                                 weight: 0.12, isReliable: M17.isReliable                         },
    { id: 'M18', score: M18.score,                                 weight: 0.06, isReliable: M18.isReliable                         },
    { id: 'M24', score: M24.score,                                 weight: 0.06, isReliable: M24.isReliable                         },
  ];

  const regimeModifier = v2.M16_regimeStability?.isReliable
    ? v2.M16_regimeStability.regimeModifier
    : 0;

  const v3Composite = computeComposite(
    compositeModels,
    v2.M9_fakeBreakoutRisk.score,
    v2.M9_fakeBreakoutRisk.isReliable,
    regimeModifier
  );

  return {
    ...v2,
    M17_smartDumbDivergence:     M17,
    M18_topBrokerPricePosition:  M18,
    M24_distributionDetector:    M24,
    v3Composite,
  };
}

// ── Convenience: extract extension scores for compositeEngineV3 ──

export interface BandarmologyExtensionScores {
  m17Score:   number | null;
  m18GapPct:  number | null;
  m24Score:   number | null;
}

export function extractExtensionScores(
  v3: BandarmologyV3Result
): BandarmologyExtensionScores {
  return {
    m17Score:  v3.M17_smartDumbDivergence.score,
    m18GapPct: v3.M18_topBrokerPricePosition.gapPct,
    m24Score:  v3.M24_distributionDetector.detectionScore, // raw detection (not inverted)
  };
}

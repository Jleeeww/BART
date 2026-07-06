/**
 * ============================================================
 * BANDARMOLOGY INTELLIGENCE CORE v2.0
 * ============================================================
 * server/engine/bandarmologyCore.ts
 *
 * INSTITUTIONAL-GRADE BEHAVIORAL DETECTION ENGINE
 * Indonesian Stock Exchange (IDX)
 *
 * DESIGN AXIOMS:
 *   - Deterministic: same input → same output, always
 *   - Symmetric: neutral stock → score 50.0 (proven: normalize(0,-1,1)=50)
 *   - Safe: no crash on any input (null, NaN, Inf, empty)
 *   - Explainable: every formula documented with numerical proofs
 *   - No ML, no randomness, no external state
 *
 * v2.0 CHANGES vs v1.x:
 *   - CRITICAL: Symmetric bounds (-1.0, 1.0) replace asymmetric (-0.5, 1.5)
 *     → neutral stock now scores 50.0 instead of 25.0
 *   - M6 FlowNormalized: symmetric bounds
 *   - M8 StealthAccumulation: redesigned (persistence × consistency)
 *   - M12 RollingAccumulation: recency weights [1,2,3,4,5]
 *   - M13 CalendarSafety: extended suppression chain
 *   - M14 CampaignDuration: NEW — trailing streak maturity
 *   - M15 PriceElasticity: NEW — absorption quality
 *   - M16 RegimeStability: NEW — reads M6 HISTORY (not current M6)
 *   - Composite: weight renormalization over active models only
 *   - DataIntegrityValidator: six silent corruption categories
 *   - LiquidityTier: four-tier micro-cap guard
 *
 * MODEL INVENTORY (12 models):
 *   Foundation: M1 M2 M3 M6 M9
 *   Pattern:    M7 M8 M11 M12 M14
 *   Risk/Context: M13(filter) M15 M16
 *
 * CALIBRATION REFERENCE (v2.0):
 *   M6/M12  100 = max accumulation  (flow ≥ 1.0 × avg20d)
 *           75  = strong accum      (flow = 0.5 × avg20d)
 *           50  = TRUE NEUTRAL      (flow = 0)  ← v2.0 fix
 *           25  = strong distrib    (flow = -0.5 × avg20d)
 *           0   = max distribution  (flow ≤ -1.0 × avg20d)
 *
 * ============================================================
 */

// ============================================================
// SECTION 0: MATHEMATICAL PRIMITIVES
// All models are composed exclusively of these four primitives.
// No other mathematical operations at the model level.
// ============================================================

/**
 * Clamp a value to [lo, hi].
 * NaN and Infinity collapse to lo (conservative: fail toward zero, not 100).
 */
export function clamp(value: number, lo = 0.0, hi = 100.0): number {
  if (value === null || value === undefined) return lo;
  if (isNaN(value) || !isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Normalize a value from [lo, hi] to [0, 100] with full guards.
 *
 * PROOF of neutral calibration with symmetric bounds:
 *   safe_normalize(0, -1.0, 1.0)
 *   = clamp((0 - (-1.0)) / (1.0 - (-1.0)) * 100)
 *   = clamp(1.0 / 2.0 * 100)
 *   = clamp(50.0) = 50.0 ✓
 *
 * @param nanDefault - returned on any invalid input (default 50 = neutral)
 */
export function safe_normalize(
  value: number | null | undefined,
  lo: number,
  hi: number,
  nanDefault = 50.0
): number {
  if (value === null || value === undefined) return nanDefault;
  if (isNaN(value) || !isFinite(value)) return nanDefault;
  if (hi === lo) return nanDefault; // zero-range guard
  return clamp((value - lo) / (hi - lo) * 100.0);
}

/**
 * Safe division. Returns nanDefault on any invalid input.
 * nanDefault=null means "no signal" — distinct from score=0 (minimum signal).
 */
export function safe_div(
  num: number | null | undefined,
  denom: number | null | undefined,
  nanDefault: number | null = null
): number | null {
  if (num === null || num === undefined) return nanDefault;
  if (denom === null || denom === undefined) return nanDefault;
  if (isNaN(num) || isNaN(denom)) return nanDefault;
  if (!isFinite(num) || !isFinite(denom)) return nanDefault;
  if (denom === 0) return nanDefault;
  const result = num / denom;
  if (isNaN(result) || !isFinite(result)) return nanDefault;
  return result;
}

/**
 * Filter NaN/null/Infinity from a flow history array.
 * Returns null if fewer than minLength valid entries remain.
 *
 * CRITICAL DATA CONTRACT:
 *   history[0] = OLDEST session
 *   history[N-1] = TODAY (most recent)
 *   This MUST be enforced by the data pipeline.
 *   Reversed delivery inverts M12 recency weights silently.
 */
export function clean_history(
  history: (number | null | undefined)[] | null | undefined,
  minLength = 5
): number[] | null {
  if (!history || history.length === 0) return null;
  const clean = history.filter(
    (f): f is number =>
      f !== null && f !== undefined && !isNaN(f) && isFinite(f)
  );
  return clean.length >= minLength ? clean : null;
}

/**
 * Least-squares linear slope. Fully deterministic.
 * Returns 0.0 on degenerate input (constant array, < 2 values).
 */
export function linear_slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0.0;
  const xm = (n - 1) / 2.0;
  const ym = values.reduce((s, v) => s + v, 0) / n;
  const num = values.reduce((s, v, i) => s + (i - xm) * (v - ym), 0);
  const den = values.reduce((s, _, i) => s + (i - xm) ** 2, 0);
  return den === 0 ? 0.0 : num / den;
}

/**
 * Parse an IDR value string into a numeric IDR amount.
 * "125.5B IDR" → 125_500_000_000
 * "1.2T IDR"   → 1_200_000_000_000
 * null          → 0
 */
export function parseIDR(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const str = String(val).trim().toUpperCase().replace(/,/g, "");
  const num = parseFloat(str.replace(/[^\d.-]/g, ""));
  if (isNaN(num)) return 0;
  if (str.includes("T")) return num * 1_000_000_000_000;
  if (str.includes("B")) return num * 1_000_000_000;
  if (str.includes("M")) return num * 1_000_000;
  if (str.includes("K")) return num * 1_000;
  return num;
}

// ============================================================
// SECTION 1: LIQUIDITY TIER GUARD
// Prevents micro-cap false conviction.
// Score sensitivity per 1B IDR noise = 100 / (2 × avg20dValue).
// At avg20d=1B: 50 pts per 1B noise. At avg20d=600B: 0.083 pts. 
// ============================================================

export interface LiquidityTier {
  tier: 1 | 2 | 3 | 4;
  isValid: boolean;        // tier 4 = false, all others = true
  isReliable: boolean;     // tier 3 = false, tiers 1-2 = true
  note?: string;
}

/**
 * Classify stock by avg20dValue into four liquidity tiers.
 * All models check this before computing.
 */
export function getLiquidityTier(avg20dValue: number | null | undefined): LiquidityTier {
  if (avg20dValue === null || avg20dValue === undefined || isNaN(avg20dValue) || avg20dValue < 2e9) {
    return { tier: 4, isValid: false, isReliable: false, note: "below liquidity floor — null" };
  }
  if (avg20dValue < 10e9) {
    return { tier: 3, isValid: true, isReliable: false, note: "low liquidity — isReliable=false" };
  }
  if (avg20dValue < 50e9) {
    return { tier: 2, isValid: true, isReliable: true, note: "moderate liquidity" };
  }
  return { tier: 1, isValid: true, isReliable: true };
}

// ============================================================
// SECTION 2: DATA INTEGRITY VALIDATOR
// Runs before all model computation.
// Catches six categories of silent corruption.
// ============================================================

export interface IntegrityReport {
  clean: CleanInputs;
  errors: string[];    // block computation
  warnings: string[];  // allow with flags
  isValid: boolean;    // false if any errors
}

export interface CleanInputs {
  avg20dValue: number | null;
  netTotalFlow: number | null;
  netForeignFlow: number | null;
  netDomesticFlow: number | null;
  netFlowHistory: number[];
  volumeRatio: number | null;
  priceChangePct: number | null;
  calendarFlags: CalendarFlags;
}

export interface CalendarFlags {
  isExDividend: boolean;
  isRebalanceDay: boolean;
  isRightsIssuePeriod: boolean;
  isPostSuspension: boolean;
  isWindowDressingPeriod: boolean;
}

export interface RawValidatorInput {
  avg20dValue?: number | null;
  netTotalFlow?: number | null;
  netForeignFlow?: number | null;
  netDomesticFlow?: number | null;
  netFlowHistory?: (number | null | undefined)[] | null;
  volumeRatio?: number | null;
  priceChangePct?: number | null;
  calendarFlags?: Partial<CalendarFlags> | null;
}

export function validateInputs(raw: RawValidatorInput): IntegrityReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── avg20dValue ──────────────────────────────────────────
  let avg20dValue: number | null = null;
  const rawAvg = raw.avg20dValue;
  if (rawAvg === null || rawAvg === undefined) {
    errors.push("E001: avg20dValue is null — cannot compute any flow models");
  } else if (isNaN(rawAvg) || !isFinite(rawAvg)) {
    errors.push("E002: avg20dValue is NaN/Inf — data pipeline error");
  } else if (rawAvg < 0) {
    errors.push(`E003: avg20dValue=${rawAvg.toExponential(2)} is negative — invalid`);
  } else if (rawAvg < 2e9) {
    warnings.push(`W001: avg20dValue=${(rawAvg / 1e9).toFixed(2)}B below liquidity floor — tier 4`);
    avg20dValue = rawAvg;
  } else if (rawAvg < 10e9) {
    warnings.push(`W002: avg20dValue=${(rawAvg / 1e9).toFixed(2)}B — tier 3, isReliable=false`);
    avg20dValue = rawAvg;
  } else {
    avg20dValue = rawAvg;
  }

  // ── flow fields ──────────────────────────────────────────
  function cleanFlow(key: string, val: number | null | undefined): number | null {
    if (val === null || val === undefined) return null;
    if (isNaN(val) || !isFinite(val)) {
      errors.push(`E004: ${key}=${val} is NaN/Inf — data corruption`);
      return null;
    }
    if (avg20dValue && Math.abs(val) > 50 * avg20dValue) {
      warnings.push(`W003: ${key}=${(val / 1e9).toFixed(1)}B is >50× avg20d — possible data error`);
    }
    return val;
  }

  const netTotalFlow = cleanFlow("netTotalFlow", raw.netTotalFlow);
  const netForeignFlow = cleanFlow("netForeignFlow", raw.netForeignFlow);
  const netDomesticFlow = cleanFlow("netDomesticFlow", raw.netDomesticFlow);

  // Sign convention anomaly check
  if (netForeignFlow !== null && netTotalFlow !== null && Math.abs(netForeignFlow) > Math.abs(netTotalFlow) * 2) {
    warnings.push("W004: netForeignFlow magnitude > 2× netTotalFlow — possible sign convention error");
  }

  // ── netFlowHistory ───────────────────────────────────────
  const rawHist = raw.netFlowHistory || [];
  const cleanHist: number[] = [];
  rawHist.forEach((f, i) => {
    if (f === null || f === undefined || isNaN(f as number) || !isFinite(f as number)) {
      warnings.push(`W005: netFlowHistory[${i}]=${f} — removed, using partial history`);
    } else {
      cleanHist.push(f as number);
    }
  });

  // ── volumeRatio ──────────────────────────────────────────
  let volumeRatio: number | null = null;
  if (raw.volumeRatio !== null && raw.volumeRatio !== undefined) {
    if (raw.volumeRatio < 0) {
      errors.push(`E005: volumeRatio=${raw.volumeRatio} is negative — impossible`);
    } else if (raw.volumeRatio > 20) {
      warnings.push(`W006: volumeRatio=${raw.volumeRatio.toFixed(1)} is >20× — extreme`);
      volumeRatio = raw.volumeRatio;
    } else {
      volumeRatio = raw.volumeRatio;
    }
  }

  // ── priceChangePct ───────────────────────────────────────
  let priceChangePct: number | null = null;
  if (raw.priceChangePct !== null && raw.priceChangePct !== undefined) {
    if (isNaN(raw.priceChangePct) || !isFinite(raw.priceChangePct)) {
      warnings.push("W007: priceChangePct is NaN/Inf — M15 will return null");
    } else {
      priceChangePct = raw.priceChangePct;
    }
  }

  // ── calendarFlags ────────────────────────────────────────
  const cal = raw.calendarFlags || {};
  const calendarFlags: CalendarFlags = {
    isExDividend:           Boolean(cal.isExDividend),
    isRebalanceDay:         Boolean(cal.isRebalanceDay),
    isRightsIssuePeriod:    Boolean(cal.isRightsIssuePeriod),
    isPostSuspension:       Boolean(cal.isPostSuspension),
    isWindowDressingPeriod: Boolean(cal.isWindowDressingPeriod),
  };

  return {
    clean: {
      avg20dValue,
      netTotalFlow,
      netForeignFlow,
      netDomesticFlow,
      netFlowHistory: cleanHist,
      volumeRatio,
      priceChangePct,
      calendarFlags,
    },
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}

// ============================================================
// SECTION 3: INPUT / OUTPUT TYPES
// ============================================================

/** One broker's trading activity for a single session. */
export interface BrokerRecord {
  code: string;
  netBuyRaw: string | null;
  netSellRaw: string | null;
  volumePercent: string | null;
  avgBuyPrice: string | null;
  avgSellPrice: string | null;
}

/** Foreign and domestic flow summary. */
export interface FlowSummary {
  netForeignFlow: number;
  netDomesticFlow: number;
  foreignBuy: number;
  foreignSell: number;
  domesticBuy: number;
  domesticSell: number;
}

/** Price data for the current session. */
export interface PriceData {
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  avgBuyPrice: number;
  avgSellPrice: number;
}

/** Volume data — current session vs historical average. */
export interface VolumeData {
  todayVolume: number;
  avg20dVolume: number;
  todayValue: number;
  avg20dValue: number;
}

/** Categorical flow signals from upstream engine. */
export interface FlowSignals {
  flowBias: "Akumulasi" | "Distribusi" | "Netral";
  flowIntensity:
    | "Akumulasi Besar"
    | "Akumulasi Sedang"
    | "Akumulasi Ringan"
    | "Netral"
    | "Distribusi Ringan"
    | "Distribusi Sedang"
    | "Distribusi Besar"
    | "Tidak Ada Data";
  flowReliability: "Tinggi" | "Sedang" | "Rendah";
}

/**
 * Complete v2.0 input.
 * m6ScoreHistory: last N M6 scores from persistent storage (OLDEST→NEWEST).
 * Used by M16 RegimeStability. NEVER populate from today's M6 computation.
 */
export interface BandarmologyInput {
  brokers: BrokerRecord[];
  flow: FlowSummary;
  price: PriceData;
  volume: VolumeData;
  signals: FlowSignals;
  netFlowHistory: number[] | null;         // oldest→newest netTotal (for legacy use). CRITICAL: data contract.
  foreignFlowHistory: number[] | null;     // oldest→newest netForeignFlow. Used by M6/M8/M12/M14.
  priceHistory: number[] | null;
  m6ScoreHistory: number[] | null;         // prior-session M6 scores for M16. NEVER today.
  calendarFlags?: Partial<CalendarFlags> | null;
}

// ── Model output types ────────────────────────────────────────

export interface ModelScore {
  score: number | null;    // null = no signal (not zero = minimum signal)
  isReliable: boolean;
  weight: number;          // composite weight
  note?: string;
}

export type MaturityLabel = "FORMING" | "ACTIVE" | "MATURE" | "EXTENDED" | "NO_CAMPAIGN";

export type RegimeLabel =
  | "ACCUMULATION"
  | "ACCUMULATION_FADING"
  | "DISTRIBUTION"
  | "RECOVERY"
  | "VOLATILE"
  | "TRANSITION"
  | "NOISE";

export interface M14Output extends ModelScore {
  campaignAge: number;
  maturity: MaturityLabel;
  avgSessionFlow: number | null;
}

export interface M15Output extends ModelScore {
  elasticity: number | null;
}

export interface M16Output {
  regime: RegimeLabel;
  regimeModifier: number;
  confidence: number;
  stabilityScore: number;
  flowMean: number;
  flowStd: number;
  flowTrend: number;
  isReliable: boolean;
}

export interface M11Output extends ModelScore {
  foreignScore: number;
  domesticScore: number;
  alignmentScore: number;
  compositeScore: number;
}

export interface CompositeResult {
  score: number | null;
  rawScore: number | null;
  regimeModifier: number;
  riskPenalty: number;
  confidence: number;    // % of total weight that was active
  activeModels: number;
  suppressedModels: number;
}

/**
 * Complete v2.0 result from computeBandarmologyV2().
 */
export interface BandarmologyV2Result {
  // Foundation models
  M1_accumulationStrength: ModelScore;
  M2_absorptionScore: ModelScore;
  M3_brokerDominance: ModelScore;
  M6_flowNormalized: ModelScore;
  M9_fakeBreakoutRisk: ModelScore;

  // Pattern models
  M7_brokerRotation: ModelScore;
  M8_stealthAccumulation: ModelScore;
  M11_flowDecomposition: M11Output;
  M12_rollingAccumulation: ModelScore;
  M14_campaignDuration: M14Output;

  // Risk/context models
  M15_priceElasticity: M15Output;
  M16_regimeStability: M16Output | null;

  // Composite
  composite: CompositeResult;

  // Integrity
  integrityReport: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };

  // Engine metadata
  meta: {
    engineVersion: "2.0.0";
    liquidityTier: 1 | 2 | 3 | 4;
    calendarSuppression: string[];
  };
}

// ============================================================
// SECTION 4: FOUNDATION MODELS (M1, M2, M3)
// These use v1.x logic with v2.0 weight assignment.
// ============================================================

interface ParsedBroker {
  code: string;
  netBuy: number;
  netSell: number;
  net: number;
  volumePct: number;
  avgBuy: number;
  avgSell: number;
  role: "Accumulator" | "Distributor" | "Neutral";
}

function parseBrokers(raw: BrokerRecord[]): ParsedBroker[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((b) => {
    const netBuy = parseIDR(b.netBuyRaw);
    const netSell = parseIDR(b.netSellRaw);
    const net = netBuy - netSell;
    const volumePct = parseFloat((b.volumePercent || "0").replace(/[^\d.]/g, "")) || 0;
    const avgBuy = parseFloat((b.avgBuyPrice || "0").replace(/[^\d.]/g, "")) || 0;
    const avgSell = parseFloat((b.avgSellPrice || "0").replace(/[^\d.]/g, "")) || 0;
    const role: ParsedBroker["role"] =
      net > 0 ? "Accumulator" : net < 0 ? "Distributor" : "Neutral";
    return { code: b.code, netBuy, netSell, net, volumePct, avgBuy, avgSell, role };
  });
}

/**
 * M1 — Accumulation Strength
 * Measures probability of institutional accumulation.
 * Uses broker consistency, flow direction, flow stability.
 */
function computeM1(input: BandarmologyInput): ModelScore {
  const WEIGHT = 0.12;
  const brokers = parseBrokers(input.brokers);

  if (brokers.length === 0) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "no broker data" };
  }

  // Broker consistency: fraction of net-positive brokers
  const accumulators = brokers.filter((b) => b.net > 0);
  const brokerConsistency = safe_normalize(accumulators.length / brokers.length, 0, 1);

  // Flow direction: net flow vs avg20d
  const avg20d = input.volume.avg20dValue;
  const netFlow = input.flow.netForeignFlow + input.flow.netDomesticFlow;
  const flowRatio = safe_div(netFlow, avg20d);
  const flowDirection =
    flowRatio !== null ? safe_normalize(flowRatio, -1.0, 1.0) : 50;

  // Volume confirmation: today vs 20d average (slight volume increase is healthy)
  const volRatio = safe_div(input.volume.todayValue, avg20d);
  const volConfirm = volRatio !== null ? safe_normalize(volRatio, 0.5, 2.5) : 50;

  const score = clamp(
    brokerConsistency * 0.45 +
    flowDirection     * 0.35 +
    volConfirm        * 0.20
  );

  const liq = getLiquidityTier(avg20d);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M2 — Absorption Score
 * Detects hidden accumulation via range compression and price-volume behaviour.
 * High absorption: high volume, narrow range, price near close.
 */
function computeM2(input: BandarmologyInput): ModelScore {
  const WEIGHT = 0.10;
  const { high, low, close, prevClose } = input.price;

  if (high <= 0 || low <= 0 || close <= 0) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "no price data" };
  }

  const range = high - low;
  const priceMovePct = prevClose > 0 ? Math.abs(close - prevClose) / prevClose * 100 : 0;
  const volRatio = safe_div(input.volume.todayValue, input.volume.avg20dValue) ?? 1.0;

  // Range compression: narrow range on high volume = absorption
  const rangeNorm = range > 0 ? clamp(prevClose / range / 20) : 50;
  const volSignal = safe_normalize(volRatio, 0.5, 2.0);
  const priceControl = safe_normalize(5 - priceMovePct, -5, 5); // low % move = high score

  const score = clamp(rangeNorm * 0.40 + volSignal * 0.30 + priceControl * 0.30);

  const liq = getLiquidityTier(input.volume.avg20dValue);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M3 — Broker Dominance
 * Measures concentration of institutional activity in top brokers.
 * High dominance = few brokers controlling most volume = institutional.
 */
function computeM3(input: BandarmologyInput): ModelScore {
  const WEIGHT = 0.10;
  const brokers = parseBrokers(input.brokers);

  if (brokers.length === 0) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "no broker data" };
  }

  // HHI-inspired: sum of (share_i)^2 for net-positive brokers
  const totalAbsNet = brokers.reduce((s, b) => s + Math.abs(b.net), 0);
  if (totalAbsNet === 0) {
    return { score: 50, isReliable: true, weight: WEIGHT };
  }

  const accumulators = brokers.filter((b) => b.net > 0);
  const topAccumShare = accumulators
    .sort((a, b) => b.net - a.net)
    .slice(0, 3)
    .reduce((s, b) => s + b.net / totalAbsNet, 0);

  const score = safe_normalize(topAccumShare, 0, 0.8);

  const liq = getLiquidityTier(input.volume.avg20dValue);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M7 — Broker Rotation
 * Detects whether institutional brokers are rotating into the stock.
 * Pattern: new dominant buyers not seen in prior sessions.
 */
function computeM7(input: BandarmologyInput): ModelScore {
  const WEIGHT = 0.08;
  const brokers = parseBrokers(input.brokers);

  if (brokers.length < 2) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "insufficient broker data" };
  }

  // Use top-3 net buyers' volume concentration as rotation proxy
  const totalVol = brokers.reduce((s, b) => s + b.volumePct, 0);
  if (totalVol === 0) {
    return { score: 50, isReliable: true, weight: WEIGHT };
  }
  const top3VolShare = brokers
    .filter((b) => b.net > 0)
    .sort((a, b) => b.volumePct - a.volumePct)
    .slice(0, 3)
    .reduce((s, b) => s + b.volumePct, 0) / totalVol;

  const score = safe_normalize(top3VolShare, 0.1, 0.6);

  const liq = getLiquidityTier(input.volume.avg20dValue);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M9 — Fake Breakout Risk (INVERTED model)
 * High score = high fake risk = REDUCES composite (risk penalty).
 * Detects breakout where price rises but institutional flow is absent.
 */
function computeM9(input: BandarmologyInput): ModelScore {
  const WEIGHT = 0.08;
  const { close, prevClose } = input.price;
  const avg20d = input.volume.avg20dValue;

  if (prevClose <= 0 || avg20d <= 0) {
    return { score: 50, isReliable: true, weight: WEIGHT }; // neutral risk if no data
  }

  const priceChangePct = (close - prevClose) / prevClose * 100;
  const netFlow = input.flow.netForeignFlow + input.flow.netDomesticFlow;
  const flowRatio = safe_div(netFlow, avg20d) ?? 0;

  // Fake breakout: price rising + flow absent or negative
  // weakFlow: low flow ratio inverted to 0–100 where 100 = very weak flow
  const flowScore = safe_normalize(flowRatio, -1.0, 1.0);
  const weakFlow = 100 - flowScore;

  // Price acceleration without flow = risk
  const priceRisk = safe_normalize(priceChangePct, -5, 10);

  // Risk = high price move × weak flow
  const rawRisk = priceRisk * 0.5 + weakFlow * 0.5;
  const score = clamp(rawRisk);

  const liq = getLiquidityTier(avg20d);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

// ============================================================
// SECTION 5: v2.0 FLOW MODELS (M6, M8, M11, M12)
// ============================================================

/**
 * M6 — FlowNormalized v2.0
 *
 * Uses netForeignFlow (not netTotal) as the primary signal.
 * In IDX, foreign net flow IS the institutional/smart-money signal.
 * netTotal = netForeign + netDomestic ≈ 0 always (they are mathematical mirrors),
 * so using netTotal yields a ratio ≈ 0 every day → score stuck at 50.
 *
 * SYMMETRIC BOUNDS (-1.0, 1.0) — true neutral at ratio=0 → score=50.0 ✓
 * Upper clamp fires at foreignFlow ≥ avg20dValue (maximum institutional signal).
 */
export function computeM6(
  netForeignFlow: number | null,
  avg20dValue: number | null
): ModelScore {
  const WEIGHT = 0.13;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "tier 4 — below liquidity floor" };
  }

  const flowRatio = safe_div(netForeignFlow, avg20dValue);
  if (flowRatio === null) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "flow or avg20d unavailable" };
  }

  // SYMMETRIC BOUNDS: neutral (ratio=0) → score=50.0
  const score = safe_normalize(flowRatio, -1.0, 1.0);

  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M8 — StealthAccumulation v2.0
 *
 * Redesigned from single-session magnitude to PERSISTENCE × CONSISTENCY.
 * Detects campaigns invisible to M6 due to small absolute flow.
 *
 * INSIGHT: Stealth accumulation cannot be detected by flow magnitude alone.
 * The signal lives in the PATTERN of flow — consistent direction, low variance.
 *
 * FORMULA:
 *   signPersistence = count(flow_i > 0 for i in last 5) / 5   [0→1]
 *   flowConsistency = 1 - stdDev(flows) / max(|mean(flows)|, floor)  [0→1]
 *   stealthScore    = normalize(signPersistence × flowConsistency, 0, 1)
 *   brokerBoost     = (brokerDominanceScore - 50) / 100 × 20   (optional)
 *
 * PHYSICAL LIMIT: Stealth on 600B+ avg20d at <50B/day flows is below the
 * statistical noise floor. This is not a model failure — it is market reality.
 * Stealth detection is most effective on 30–200B avg20d stocks.
 *
 * GATES:
 *   - mean(flows) ≤ 0: score=0 (not accumulation)
 *   - signPersistence < 0.6: score=0 (not persistent)
 *   - min 5 clean sessions required
 */
export function computeM8(
  foreignFlowHistory: (number | null | undefined)[] | null,
  avg20dValue: number | null,
  brokerDominanceScore?: number | null
): ModelScore {
  const WEIGHT = 0.10;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "tier 4" };
  }

  const history = clean_history(foreignFlowHistory);
  if (!history) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "insufficient history" };
  }

  const recent = history.slice(-5);
  const meanFlow = recent.reduce((s, f) => s + f, 0) / recent.length;

  // Gate: must be net positive accumulation
  if (meanFlow <= 0) {
    return { score: 0, isReliable: true, weight: WEIGHT };
  }

  // Signal 1: Sign persistence
  const signPersistence = recent.filter((f) => f > 0).length / recent.length;
  if (signPersistence < 0.6) {
    return { score: 0, isReliable: true, weight: WEIGHT };
  }

  // Signal 2: Flow consistency (low coefficient of variation)
  const variance =
    recent.reduce((s, f) => s + (f - meanFlow) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  const minFlow = Math.max(Math.abs(meanFlow), 0.01 * (avg20dValue ?? 1e9));
  const cv = stdDev / minFlow;
  const flowConsistency = clamp(1.0 - cv, 0, 1);

  // Core score: persistence × consistency
  const raw = signPersistence * flowConsistency;
  let score = safe_normalize(raw, 0.0, 1.0);

  // Broker enhancement (optional — uses M3 output)
  if (brokerDominanceScore !== null && brokerDominanceScore !== undefined) {
    const boost = (brokerDominanceScore - 50) / 100.0 * 20;
    score = clamp(score + boost);
  }

  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

/**
 * M11 — FlowDecomposition
 *
 * Decomposes total flow into foreign and domestic components.
 * Measures their alignment (coordination vs opposition).
 *
 * v2.0 addition: compositeScore maps alignmentScore to [0,100] for
 * direct use in composite weighted average.
 *
 * FORMULA:
 *   foreignScore   = normalize(netForeignFlow / avg20d, -1.0, 1.0)
 *   domesticScore  = normalize(netDomesticFlow / avg20d, -1.0, 1.0)
 *   avgScore       = (foreignScore + domesticScore) / 2
 *   agreementFactor = 1 - |foreignScore - domesticScore| / 100
 *   alignmentScore = (avgScore - 50) × agreementFactor × 2   range: [-100, +100]
 *   compositeScore = clamp((alignmentScore + 100) / 2)       range: [0, 100]
 *
 * PROOF: zero flows → foreignScore=50, domesticScore=50, avgScore=50,
 *   agreementFactor=1.0, alignmentScore=(50-50)×1×2=0, compositeScore=50 ✓
 */
export function computeM11(
  netForeignFlow: number | null,
  netDomesticFlow: number | null,
  avg20dValue: number | null
): M11Output {
  const WEIGHT = 0.08;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return {
      score: null, isReliable: false, weight: WEIGHT,
      foreignScore: 50, domesticScore: 50, alignmentScore: 0, compositeScore: 50,
    };
  }

  // If flow is null, treat as zero (neutral, not missing)
  const fRatio = safe_div(netForeignFlow ?? 0, avg20dValue) ?? 0;
  const dRatio = safe_div(netDomesticFlow ?? 0, avg20dValue) ?? 0;

  const foreignScore  = safe_normalize(fRatio, -1.0, 1.0);
  const domesticScore = safe_normalize(dRatio, -1.0, 1.0);
  const avgScore       = (foreignScore + domesticScore) / 2.0;
  const agreementFactor = 1.0 - Math.abs(foreignScore - domesticScore) / 100.0;
  const alignmentScore  = (avgScore - 50.0) * agreementFactor * 2.0;
  const compositeScore  = clamp((alignmentScore + 100.0) / 2.0);

  return {
    score: compositeScore,
    isReliable: liq.isReliable,
    weight: WEIGHT,
    foreignScore: Number(foreignScore.toFixed(4)),
    domesticScore: Number(domesticScore.toFixed(4)),
    alignmentScore: Number(alignmentScore.toFixed(4)),
    compositeScore: Number(compositeScore.toFixed(4)),
  };
}

/**
 * M12 — RollingAccumulation v2.0
 *
 * 5-session rolling accumulation with RECENCY WEIGHTING [1,2,3,4,5].
 *
 * v1.x used equal weights → building [10→200]B ≡ tapering [200→10]B.
 * v2.0 recency weights make building campaigns score higher than fading.
 *
 * PROOF (verified numerically):
 *   TAPERING [200,150,100,50,10]B on 600B avg:
 *     weightedAvg = (1×200+2×150+3×100+4×50+5×10)/15 = 70B
 *     score = normalize(70/600, -1.0, 1.0) = 55.8
 *   BUILDING [10,50,100,150,200]B on 600B avg:
 *     weightedAvg = (1×10+2×50+3×100+4×150+5×200)/15 = 134B
 *     score = normalize(134/600, -1.0, 1.0) = 61.2
 *   building > tapering ✓ (same arithmetic mean, different trajectory)
 *
 * DATA CONTRACT: history[0]=OLDEST, history[-1]=TODAY.
 * Reversed delivery inverts recency — validate in data pipeline.
 *
 * SPIKE MUTING: single large session is weighted 5/15 = 33%.
 * M6-M12 divergence = spike detection signal.
 */
export function computeM12(
  foreignFlowHistory: (number | null | undefined)[] | null,
  avg20dValue: number | null
): ModelScore {
  const WEIGHT = 0.07;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "tier 4" };
  }

  const history = clean_history(foreignFlowHistory);
  if (!history) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "insufficient history" };
  }

  const recent = history.slice(-5);
  // Weights: [1,2,3,4,5] where 5 = today (most recent), 1 = 5 sessions ago
  const weights = [1, 2, 3, 4, 5];
  const totalWeight = 15; // 1+2+3+4+5
  const weightedAvg = recent.reduce((s, f, i) => s + f * weights[i], 0) / totalWeight;

  const flowRatio = safe_div(weightedAvg, avg20dValue);
  if (flowRatio === null) {
    return { score: null, isReliable: false, weight: WEIGHT, note: "avg20d unavailable" };
  }

  const score = safe_normalize(flowRatio, -1.0, 1.0);
  return { score, isReliable: liq.isReliable, weight: WEIGHT };
}

// ============================================================
// SECTION 6: NEW MODELS (M14, M15, M16)
// ============================================================

/**
 * M14 — CampaignDuration
 *
 * Measures the age and strength of the current trailing positive streak.
 * A 10-session MATURE campaign is fundamentally different from a 2-day spike
 * even at identical M6 scores.
 *
 * FORMULA:
 *   continuousStreak = trailing positive sessions from most recent backward
 *   campaignAge      = len(streak)
 *   ageComponent     = normalize(campaignAge, 0, 20)         [0→100]
 *   flowComponent    = normalize(avgFlowRatio, -1.0, 1.0)    [0→100]
 *   score            = 0.4 × ageComponent + 0.6 × flowComponent
 *
 * KEY PROPERTY: any negative session RESETS the streak.
 *   This correctly represents the CURRENT campaign's age, not lifetime.
 *
 * MATURITY:
 *   FORMING  (1-2):   too early — not isReliable
 *   ACTIVE   (3-7):   campaign confirmed
 *   MATURE   (8-15):  high conviction — rare and significant
 *   EXTENDED (>15):   watch for distribution setup
 */
export function computeM14(
  foreignFlowHistory: (number | null | undefined)[] | null,
  avg20dValue: number | null
): M14Output {
  const WEIGHT = 0.06;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return {
      score: null, isReliable: false, weight: WEIGHT,
      campaignAge: 0, maturity: "NO_CAMPAIGN", avgSessionFlow: null,
    };
  }

  const history = clean_history(foreignFlowHistory, 3);
  if (!history) {
    return {
      score: null, isReliable: false, weight: WEIGHT,
      campaignAge: 0, maturity: "NO_CAMPAIGN", avgSessionFlow: null,
    };
  }

  // Find trailing positive streak (iterates backward from today)
  const streak: number[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] > 0) streak.unshift(history[i]);
    else break;
  }

  const campaignAge = streak.length;

  if (campaignAge === 0) {
    return {
      score: 0, isReliable: true, weight: WEIGHT,
      campaignAge: 0, maturity: "NO_CAMPAIGN", avgSessionFlow: null,
    };
  }

  const avgSessionFlow = streak.reduce((s, f) => s + f, 0) / streak.length;

  const ageComponent  = safe_normalize(campaignAge, 0, 20);
  const flowRatio     = safe_div(avgSessionFlow, avg20dValue) ?? 0;
  const flowComponent = safe_normalize(flowRatio, -1.0, 1.0);

  const score = clamp(0.4 * ageComponent + 0.6 * flowComponent);

  const maturity: MaturityLabel =
    campaignAge < 3   ? "FORMING"
    : campaignAge <= 7  ? "ACTIVE"
    : campaignAge <= 15 ? "MATURE"
    :                     "EXTENDED";

  const isReliable = campaignAge >= 3 && liq.isReliable;

  return {
    score,
    isReliable,
    weight: WEIGHT,
    campaignAge,
    maturity,
    avgSessionFlow: Number(avgSessionFlow.toFixed(0)),
  };
}

/**
 * M15 — PriceElasticity
 *
 * Measures price movement per unit of net flow.
 * LOW elasticity = strong institutional control (bandar absorbing supply).
 * HIGH elasticity = retail/pump (price moving on uncontrolled buying).
 *
 * The score is INVERTED: high absorbedScore = low elasticity = institutional.
 *
 * FORMULA:
 *   flowRatio    = netTotalFlow / avg20dValue
 *   elasticity   = |priceChange%| / |flowRatio|
 *   absorbedScore = normalize(1/elasticity, 0, 1/ELASTICITY_FLOOR × 1/CEILING)
 *
 * SPECIAL CASES:
 *   flow ≈ 0:               null (not enough flow to measure)
 *   priceChange ≈ 0 AND positive flow: score=90 (perfect absorption)
 *   positive flow, price declining: bonus +15 (absorption into downward pressure)
 *
 * FAILURE CASES:
 *   - Halted stocks: priceImpact=0 always → always 90 (known false positive)
 *   - Thin stocks: single trade moves price → structural, not flow elasticity
 */
export function computeM15(
  priceChangePct: number | null,
  netTotalFlow: number | null,
  avg20dValue: number | null
): M15Output {
  const WEIGHT = 0.04;
  const MIN_FLOW_RATIO  = 0.01;   // at least 1% of avg20d
  const MIN_PRICE_CHANGE = 0.05;  // 0.05% — threshold for "flat"
  const ELASTICITY_CEILING = 20.0;

  const liq = getLiquidityTier(avg20dValue);
  if (!liq.isValid) {
    return { score: null, isReliable: false, weight: WEIGHT, elasticity: null };
  }

  const flowRatio = safe_div(netTotalFlow, avg20dValue);
  if (flowRatio === null || Math.abs(flowRatio) < MIN_FLOW_RATIO) {
    return {
      score: null, isReliable: false, weight: WEIGHT, elasticity: null,
      note: "flow too small to measure elasticity",
    };
  }

  if (priceChangePct === null || priceChangePct === undefined ||
      isNaN(priceChangePct) || !isFinite(priceChangePct)) {
    return { score: null, isReliable: false, weight: WEIGHT, elasticity: null };
  }

  // Perfect absorption: positive flow + flat price
  if (Math.abs(priceChangePct) < MIN_PRICE_CHANGE && flowRatio > 0) {
    return {
      score: 90,
      isReliable: true,
      weight: WEIGHT,
      elasticity: 0,
      note: "perfect absorption",
    };
  }

  const elasticity = Math.abs(priceChangePct) / Math.abs(flowRatio);
  const inverted = 1.0 / Math.max(elasticity, 0.01);
  // normalize: best absorption = elasticity→0, inverted→∞, clamp at CEILING equivalent
  let score = safe_normalize(inverted, 0, 1.0 / (0.01 * ELASTICITY_CEILING));

  // Bonus: buying into downward pressure = strong absorption conviction
  if ((netTotalFlow ?? 0) > 0 && priceChangePct < 0) {
    score = clamp(score + 15);
  }

  return {
    score: clamp(score),
    isReliable: liq.isReliable,
    weight: WEIGHT,
    elasticity: Number(elasticity.toFixed(4)),
  };
}

/**
 * M16 — RegimeStability
 *
 * Classifies the current signal environment using M6 SCORE HISTORY.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  CRITICAL: M16 MUST read M6ScoreHistory from STORAGE.       ║
 * ║  This is prior-session M6 scores (last 5 stored sessions).  ║
 * ║  NEVER pass today's M6.score into this function.            ║
 * ║  Doing so creates a circular dependency.                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Requires at least 5 prior-session M6 scores.
 * Returns null if history unavailable (safe fallback: no regime modifier).
 *
 * FORMULA:
 *   flowMean  = avg(m6History[-5:])
 *   flowStd   = stdDev(m6History[-5:])
 *   flowTrend = linearSlope(m6History[-5:])
 *
 * REGIME CLASSIFICATION (deterministic thresholds):
 *   mean>60 AND std<15 AND trend≥0:    ACCUMULATION    (+3 modifier)
 *   mean>60 AND std<15 AND trend<-2:   ACCUMULATION_FADING (-2)
 *   mean<40 AND std<15 AND trend≤0:    DISTRIBUTION    (-3)
 *   mean<40 AND std<15 AND trend>2:    RECOVERY        (0)
 *   std>25:                            VOLATILE        (-8)
 *   35≤mean≤65:                        TRANSITION      (-2)
 *   else:                              NOISE           (-5)
 */
export function computeM16(m6ScoreHistory: number[] | null): M16Output | null {
  if (!m6ScoreHistory || m6ScoreHistory.length < 5) return null;

  const clean = m6ScoreHistory
    .filter((s): s is number => s !== null && !isNaN(s) && isFinite(s));
  if (clean.length < 5) return null;

  const recent = clean.slice(-5);
  const flowMean = recent.reduce((s, v) => s + v, 0) / 5.0;
  const variance = recent.reduce((s, v) => s + (v - flowMean) ** 2, 0) / 5.0;
  const flowStd  = Math.sqrt(variance);
  const flowTrend = linear_slope(recent);

  let regime: RegimeLabel;
  let regimeModifier: number;
  let confidence: number;

  if (flowMean > 60 && flowStd < 15 && flowTrend >= 0) {
    regime = "ACCUMULATION";
    regimeModifier = +3;
    confidence = Math.min(100, 60 + (flowMean - 60) + (15 - flowStd));
  } else if (flowMean > 60 && flowStd < 15 && flowTrend < -2) {
    regime = "ACCUMULATION_FADING";
    regimeModifier = -2;
    confidence = 55;
  } else if (flowMean < 40 && flowStd < 15 && flowTrend <= 0) {
    regime = "DISTRIBUTION";
    regimeModifier = -3;
    confidence = Math.min(100, 60 + (40 - flowMean) + (15 - flowStd));
  } else if (flowMean < 40 && flowStd < 15 && flowTrend > 2) {
    regime = "RECOVERY";
    regimeModifier = 0;
    confidence = 50;
  } else if (flowStd > 25) {
    regime = "VOLATILE";
    regimeModifier = -8;
    confidence = 30;
  } else if (flowMean >= 35 && flowMean <= 65) {
    regime = "TRANSITION";
    regimeModifier = -2;
    confidence = 40;
  } else {
    regime = "NOISE";
    regimeModifier = -5;
    confidence = 25;
  }

  const stabilityScore = safe_normalize(100 - flowStd, 50, 100);

  return {
    regime,
    regimeModifier,
    confidence: Math.round(confidence),
    stabilityScore: Number(stabilityScore.toFixed(2)),
    flowMean:  Number(flowMean.toFixed(2)),
    flowStd:   Number(flowStd.toFixed(2)),
    flowTrend: Number(flowTrend.toFixed(3)),
    isReliable: confidence >= 50,
  };
}

// ============================================================
// SECTION 7: M13 CALENDAR SAFETY (FILTER)
// Runs AFTER all models compute, BEFORE composite.
// Sets isReliable=false on models contaminated by calendar events.
// Reads NO model score values — only sets flags.
// ============================================================

interface ModelScoreMap {
  M6:  ModelScore;
  M7:  ModelScore;
  M8:  ModelScore;
  M11: M11Output;
  M12: ModelScore;
  M14: M14Output;
  M15: M15Output;
}

function applyCalendarSafety(
  outputs: ModelScoreMap,
  flags: CalendarFlags
): { suppressed: ModelScoreMap; calendarSuppression: string[] } {
  const suppressed = { ...outputs };
  const calendarSuppression: string[] = [];

  // EX-DIVIDEND DAY
  // Mechanical outflows distort ALL flow-based models.
  // v2.0: M11 and M12 added to suppression chain.
  if (flags.isExDividend) {
    suppressed.M6  = { ...suppressed.M6,  isReliable: false, note: "suppressed: ex-dividend" };
    suppressed.M11 = { ...suppressed.M11, isReliable: false, note: "suppressed: ex-dividend" };
    suppressed.M12 = { ...suppressed.M12, isReliable: false, note: "suppressed: ex-dividend" };
    calendarSuppression.push("M6 M11 M12 suppressed: ex-dividend day");
  }

  // REBALANCING DAY (LQ45, IDX30, MSCI)
  // Passive fund flows are mechanical — not bandar.
  // v2.0: M11 added (rebalancing distorts domestic allocation).
  if (flags.isRebalanceDay) {
    suppressed.M7  = { ...suppressed.M7,  isReliable: false, note: "suppressed: rebalancing" };
    suppressed.M11 = { ...suppressed.M11, isReliable: false, note: "suppressed: rebalancing" };
    calendarSuppression.push("M7 M11 suppressed: rebalance day");
  }

  // RIGHTS ISSUE PERIOD
  // Domestic subscription flows look identical to accumulation campaign.
  if (flags.isRightsIssuePeriod) {
    suppressed.M6  = { ...suppressed.M6,  isReliable: false, note: "suppressed: rights issue" };
    suppressed.M11 = { ...suppressed.M11, isReliable: false, note: "suppressed: rights issue" };
    suppressed.M12 = { ...suppressed.M12, isReliable: false, note: "suppressed: rights issue" };
    calendarSuppression.push("M6 M11 M12 suppressed: rights issue period");
  }

  // POST-SUSPENSION (first session after halt)
  // avg20dValue is stale — all ratio models are distorted.
  if (flags.isPostSuspension) {
    suppressed.M6  = { ...suppressed.M6,  isReliable: false, note: "suppressed: post-suspension" };
    suppressed.M12 = { ...suppressed.M12, isReliable: false, note: "suppressed: post-suspension" };
    calendarSuppression.push("M6 M12 suppressed: post-suspension session");
  }

  // YEAR-END WINDOW DRESSING (last 3 weeks of December)
  // Fund managers buy outperformers — systematic false campaign signal.
  // M14 maturity classification misleads during this period.
  if (flags.isWindowDressingPeriod) {
    suppressed.M14 = { ...suppressed.M14, isReliable: false, note: "suppressed: window dressing" };
    calendarSuppression.push("M14 suppressed: window dressing period");
  }

  return { suppressed, calendarSuppression };
}

// ============================================================
// SECTION 8: COMPOSITE ENGINE v2.0
//
// CRITICAL FIX from v1.x: null models are EXCLUDED from denominator.
// v1.x treated null as zero → systematic understatement (up to 20 pts).
//
// FORMULA:
//   active = models where score !== null AND isReliable !== false (excl. M9)
//   rawScore = weightedAvg(active scores) over ACTIVE weights only
//   regimeModifier = M16.regimeModifier (0 if M16 null)
//   riskPenalty = max(0, (M9.score - 50) × 0.15) — max 7.5 pts
//   finalScore = clamp(rawScore + regimeModifier - riskPenalty)
//
// CONFIDENCE: fraction of total declared weight that was active.
//   Communicates signal quality clearly to the caller.
// ============================================================

interface CompositeModelEntry {
  id: string;
  score: number | null;
  weight: number;
  isReliable: boolean;
}

/**
 * Compute v2.0 composite with weight renormalization.
 * All inputs must be normalized to [0, 100].
 */
export function computeComposite(
  models: CompositeModelEntry[],
  m9Score: number | null,
  m9IsReliable: boolean,
  regimeModifier: number
): CompositeResult {
  // Active = non-null AND isReliable (M9 handled separately as risk penalty)
  const active = models.filter(
    (m) => m.score !== null && m.isReliable
  );

  if (active.length === 0) {
    return {
      score: null, rawScore: null,
      regimeModifier, riskPenalty: 0,
      confidence: 0, activeModels: 0,
      suppressedModels: models.length,
    };
  }

  const totalActiveWeight = active.reduce((s, m) => s + m.weight, 0);
  if (totalActiveWeight === 0) {
    return {
      score: null, rawScore: null,
      regimeModifier, riskPenalty: 0,
      confidence: 0, activeModels: 0,
      suppressedModels: models.length,
    };
  }

  // Weighted average over ACTIVE weight (renormalized)
  const rawScore = active.reduce(
    (s, m) => s + (m.score as number) * m.weight / totalActiveWeight,
    0
  );

  // M9 risk penalty: reduces composite when fake breakout risk is high
  // max penalty = (100-50) × 0.15 = 7.5 pts. Neutral M9=50 → 0 penalty.
  let riskPenalty = 0;
  if (m9Score !== null && m9IsReliable) {
    riskPenalty = Math.max(0, (m9Score - 50) * 0.15);
  }

  const finalScore = clamp(rawScore + regimeModifier - riskPenalty);

  // Confidence = fraction of declared weight that was active
  const totalDeclaredWeight = models.reduce((s, m) => s + m.weight, 0);
  const confidence = totalDeclaredWeight > 0
    ? Math.round(totalActiveWeight / totalDeclaredWeight * 100)
    : 0;

  return {
    score: Number(finalScore.toFixed(2)),
    rawScore: Number(rawScore.toFixed(2)),
    regimeModifier,
    riskPenalty: Number(riskPenalty.toFixed(2)),
    confidence,
    activeModels: active.length,
    suppressedModels: models.length - active.length,
  };
}

// ============================================================
// SECTION 9: MAIN ENGINE ENTRY POINT
// computeBandarmologyV2(input, m6ScoreHistory)
//
// m6ScoreHistory: last N stored M6 scores (oldest→newest).
//   Comes from bandarmology_history table via getM6History().
//   NEVER pass today's M6.score — this creates circular dependency.
// ============================================================

export function computeBandarmologyV2(
  input: BandarmologyInput
): BandarmologyV2Result {
  // debug: engine entry — removed console.log to avoid flooding batch runners

  // ── Phase 0: Data Preparation ──────────────────────────────
  const validatorInput: RawValidatorInput = {
    avg20dValue:    input.volume.avg20dValue,
    netTotalFlow:   input.flow.netForeignFlow + input.flow.netDomesticFlow,
    netForeignFlow: input.flow.netForeignFlow,
    netDomesticFlow: input.flow.netDomesticFlow,
    netFlowHistory: input.netFlowHistory ?? [],
    volumeRatio:    input.volume.avg20dValue > 0
                      ? input.volume.todayValue / input.volume.avg20dValue
                      : null,
    priceChangePct: input.price.prevClose > 0
                      ? (input.price.close - input.price.prevClose) / input.price.prevClose * 100
                      : null,
    calendarFlags: input.calendarFlags ?? null,
  };

  const integrity = validateInputs(validatorInput);
  const liq = getLiquidityTier(input.volume.avg20dValue);

  // ── Phase 1: Foundation Models ─────────────────────────────
  // Each reads only raw inputs. No inter-model dependencies.
  const M1 = computeM1(input);
  const M2 = computeM2(input);
  const M3 = computeM3(input);

  // M6 uses netForeignFlow (the institutional/smart-money signal).
  // netTotal = netForeign + netDomestic ≈ 0 always — not a useful signal.
  const M6 = computeM6(input.flow.netForeignFlow, input.volume.avg20dValue);
  const M9 = computeM9(input);

  // netTotalFlow still used by M15 (price elasticity measurement).
  const netTotalFlow = input.flow.netForeignFlow + input.flow.netDomesticFlow;

  // ── Phase 2: Pattern Models ────────────────────────────────
  // M8 reads M3.score (Phase 1 complete — safe, no circular dep.)
  const M7  = computeM7(input);
  const M8  = computeM8(input.foreignFlowHistory, input.volume.avg20dValue, M3.score);
  const M11 = computeM11(
    input.flow.netForeignFlow,
    input.flow.netDomesticFlow,
    input.volume.avg20dValue
  );
  const M12 = computeM12(input.foreignFlowHistory, input.volume.avg20dValue);
  const M14 = computeM14(input.foreignFlowHistory, input.volume.avg20dValue);
  const M15 = computeM15(
    validatorInput.priceChangePct ?? null,
    netTotalFlow,
    input.volume.avg20dValue
  );

  // ── Phase 3: Regime Model ──────────────────────────────────
  // READS m6ScoreHistory FROM INPUT (stored prior-session scores).
  // NEVER uses today's M6.score — no circular dependency.
  const M16 = computeM16(input.m6ScoreHistory);

  // ── Phase 4: Calendar Safety Filter ───────────────────────
  // M13 sets isReliable flags. Reads NO model score values.
  const calFlags = integrity.clean.calendarFlags;
  const { suppressed, calendarSuppression } = applyCalendarSafety(
    { M6, M7, M8, M11, M12, M14, M15 },
    calFlags
  );

  // ── Phase 5: Composite ─────────────────────────────────────
  const regimeModifier = M16?.isReliable ? M16.regimeModifier : 0;

  const compositeModels: CompositeModelEntry[] = [
    { id: "M1",  score: M1.score,                    weight: M1.weight,               isReliable: M1.isReliable  },
    { id: "M2",  score: M2.score,                    weight: M2.weight,               isReliable: M2.isReliable  },
    { id: "M3",  score: M3.score,                    weight: M3.weight,               isReliable: M3.isReliable  },
    { id: "M6",  score: suppressed.M6.score,         weight: suppressed.M6.weight,    isReliable: suppressed.M6.isReliable  },
    { id: "M7",  score: suppressed.M7.score,         weight: suppressed.M7.weight,    isReliable: suppressed.M7.isReliable  },
    { id: "M8",  score: suppressed.M8.score,         weight: suppressed.M8.weight,    isReliable: suppressed.M8.isReliable  },
    { id: "M11", score: suppressed.M11.compositeScore, weight: suppressed.M11.weight, isReliable: suppressed.M11.isReliable },
    { id: "M12", score: suppressed.M12.score,        weight: suppressed.M12.weight,   isReliable: suppressed.M12.isReliable },
    { id: "M14", score: suppressed.M14.score,        weight: suppressed.M14.weight,   isReliable: suppressed.M14.isReliable },
    { id: "M15", score: suppressed.M15.score,        weight: suppressed.M15.weight,   isReliable: suppressed.M15.isReliable },
  ];

  const composite = computeComposite(
    compositeModels,
    M9.score,
    M9.isReliable,
    regimeModifier
  );

  // ── Result assembly ────────────────────────────────────────
  return {
    M1_accumulationStrength:  M1,
    M2_absorptionScore:       M2,
    M3_brokerDominance:       M3,
    M6_flowNormalized:        suppressed.M6,
    M9_fakeBreakoutRisk:      M9,
    M7_brokerRotation:        suppressed.M7,
    M8_stealthAccumulation:   suppressed.M8,
    M11_flowDecomposition:    suppressed.M11,
    M12_rollingAccumulation:  suppressed.M12,
    M14_campaignDuration:     suppressed.M14,
    M15_priceElasticity:      suppressed.M15,
    M16_regimeStability:      M16,
    composite,
    integrityReport: {
      isValid:  integrity.isValid,
      errors:   integrity.errors,
      warnings: integrity.warnings,
    },
    meta: {
      engineVersion:        "2.0.0",
      liquidityTier:        liq.tier as 1 | 2 | 3 | 4,
      calendarSuppression,
    },
  };
}
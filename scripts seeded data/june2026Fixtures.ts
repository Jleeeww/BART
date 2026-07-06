/**
 * ============================================================
 * JUNE 2026 BANDARMOLOGY VALIDATION FIXTURES
 * ============================================================
 * scripts/june2026Fixtures.ts
 *
 * Hand-transcribed IDX data for 9 stocks across the June 2026
 * trading window. Used to validate the netForeignFlow fix:
 *   M6 / M8 / M12 / M14 now read foreignFlowHistory instead of
 *   netTotalFlow (which was always ≈0 in real market data).
 *
 * TRADING DAYS (12):
 *   Jun 2, 3, 4, 5, 8, 9, 10, 11, 12, 15, 17, 18
 *   (Jun 16 = no data / public holiday)
 *
 * CRITICAL — VALIDATION DESIGN:
 *   Validate against the ACTUAL window flow direction below, NOT
 *   any stored archetype label on the stock record.
 *   Three stocks have STALE stored labels that contradict the
 *   June window:
 *     KLBF  stored=stealth-accum  →  actual=weak-dist-accelerating
 *     BBRI  stored=clean-accum    →  actual=heavy-dist+reversal
 *     BREN  stored=smart-exit     →  actual=weak-dist/outlier-noise
 *   Treat stored labels as metadata only; judge by flow data here.
 *
 * CATEGORICAL SIGNAL DERIVATION (how flowBias/Intensity/Reliability
 *   were set from the raw flow series):
 *   flowBias      — sign of 12-day sum
 *   flowIntensity — avg daily |flow| / avg20dValue ratio:
 *                   <15% → Ringan, 15-40% → Sedang, >40% → Besar
 *                   (single outlier days discounted for noisy stocks)
 *   flowReliability — directional consistency (% days matching bias):
 *                   >80% + high foreign share → Tinggi
 *                   55-80% → Sedang
 *                   <55% or thin float / extreme multiples → Rendah
 * ============================================================
 */

export const TRADING_DAYS = [
  '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
  '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11',
  '2026-06-12', '2026-06-15', '2026-06-17', '2026-06-18',
] as const;

// ── Typed fixture record ─────────────────────────────────────────

export interface June2026Fixture {
  symbol:   string;
  sector:   string;

  /**
   * Daily netForeignFlow (IDR), oldest → newest.
   * Index 0 = Jun 2, index 11 = Jun 18.
   * Negative = net foreign sell. Domestic mirrors these negatively.
   *
   * Used by:
   *   computeBandarmologyV2 → M6 (last element), M8/M12/M14 (array)
   * NOT used by computeStockReadiness (which reads categorical labels).
   */
  foreignFlowHistory: number[];

  // ── Price window ──────────────────────────────────────────────
  priceOpen:       number;  // first session (Jun 2) open, IDR
  priceClose:      number;  // last session (Jun 18) close, IDR
  changePercent:   number;  // (close - open) / open × 100

  // Last-session price estimates (Jun 18) for M2/M9/M15 in V2 path
  lastClose:    number;
  lastPrevClose: number;
  lastHigh:     number;
  lastLow:      number;

  // ── Keystats ─────────────────────────────────────────────────
  marketCap:     number;        // IDR
  float:         number;        // fraction (e.g. 0.4052)
  peTTM:         number | null; // null if loss-making
  pb:            number;        // price-to-book (informational only, not in StockReadinessInput)
  roe:           number;        // decimal (e.g. 0.1235 = 12.35%)
  evEbitda:      number;
  netMargin:     number | null; // null for banks / loss-makers
  dividendYield: number | null; // decimal (e.g. 0.05 = 5%)

  /**
   * Estimated avg 20-day trading value (IDR).
   * Derived from marketCap × float × typical daily turnover rate.
   * Used to calibrate M6/M12 ratio normalisation.
   */
  avg20dValue: number;

  // ── Categorical signals (for computeStockReadiness path) ──────
  // Derived from the 12-day foreignFlowHistory above.
  flowBias:        'Akumulasi' | 'Distribusi' | 'Netral';
  flowIntensity:   string;
  flowReliability: 'Tinggi' | 'Sedang' | 'Rendah';

  /**
   * Last-session foreign+domestic flow snapshot (Jun 18).
   * domestic = −foreign (IDX mirror constraint).
   * JSON string consumed by parseForeignData() in mapStockDataToInput.
   */
  foreignActivityData: string;

  /**
   * Broker activity snapshot.
   * Distribution stocks: all net sellers → stability = Rendah.
   * MDKA: fragmented institutional buyers → stability = Sedang.
   */
  brokerData: string;

  // ── Validation metadata ───────────────────────────────────────
  expectedArchetype: string;
  archetypeNote:     string;

  /** true if archetype passes = AVOID action expected */
  expectAvoid: boolean;
}

// ── Helper: build JSON foreignActivityData string ────────────────

function flowSnap(netForeign: number): string {
  const nF = Math.round(netForeign);
  const nD = -nF;                               // IDX mirror
  const fBuy  = nF > 0 ? nF * 1.2 : Math.abs(nF) * 0.05;
  const fSell = nF > 0 ? nF * 0.2  : Math.abs(nF) * 1.05;
  const dBuy  = nD > 0 ? nD * 1.2  : Math.abs(nD) * 0.05;
  const dSell = nD > 0 ? nD * 0.2  : Math.abs(nD) * 1.05;
  return JSON.stringify({
    netForeignFlow:  nF,
    netDomesticFlow: nD,
    foreignBuy:  Math.round(fBuy),
    foreignSell: Math.round(fSell),
    domesticBuy: Math.round(dBuy),
    domesticSell: Math.round(dSell),
  });
}

// Broker data for distribution stocks: two net-seller brokers
// → buyers[] = [] → stability = "Rendah"
const DIST_BROKERS = JSON.stringify([
  { code: 'XX', netBuy: '500M IDR', netSell: '3B IDR',   volumePercent: '10%', avgBuyPrice: '0', avgSellPrice: '0' },
  { code: 'YY', netBuy: '200M IDR', netSell: '1.5B IDR', volumePercent: '7%',  avgBuyPrice: '0', avgSellPrice: '0' },
]);

// Broker data for MDKA: 6 fragmented institutional-style buyers
// concentration = top3/total ≈ 0.545 → score ≈ 65 → "Sedang"
const MDKA_BROKERS = JSON.stringify([
  { code: 'BK',   netBuy: '5B IDR',    netSell: '4B IDR',   volumePercent: '8%',  avgBuyPrice: '2950', avgSellPrice: '2960' },
  { code: 'YP',   netBuy: '4B IDR',    netSell: '3B IDR',   volumePercent: '7%',  avgBuyPrice: '2945', avgSellPrice: '2955' },
  { code: 'CIMB', netBuy: '3B IDR',    netSell: '2.5B IDR', volumePercent: '5%',  avgBuyPrice: '2940', avgSellPrice: '2950' },
  { code: 'AK',   netBuy: '6B IDR',    netSell: '5B IDR',   volumePercent: '9%',  avgBuyPrice: '2955', avgSellPrice: '2965' },
  { code: 'ZP',   netBuy: '4B IDR',    netSell: '3B IDR',   volumePercent: '6%',  avgBuyPrice: '2948', avgSellPrice: '2958' },
  { code: 'MK',   netBuy: '3B IDR',    netSell: '2B IDR',   volumePercent: '5%',  avgBuyPrice: '2942', avgSellPrice: '2952' },
]);

// ── Fixtures ─────────────────────────────────────────────────────

export const JUNE_2026_FIXTURES: June2026Fixture[] = [

  // ── 1. TLKM — Smart-Money Exit / Capital Flight ──────────────
  // 12-day sum = −374.3B. 9/12 days negative. Price −13.7%.
  // Cleanest distribution signal: monotone sustained exit.
  // Expected: AVOID. Positive control for distribution detection.
  {
    symbol: 'TLKM',
    sector: 'Communication Services',
    foreignFlowHistory: [
      -16.66e9, -14.69e9, +34.41e9, -47.98e9,
      -135.96e9, -71.60e9, -113.64e9, +72.76e9,
      -16.34e9, +26.00e9, -28.02e9, -62.59e9,
    ],
    priceOpen: 2990, priceClose: 2580, changePercent: -13.71,
    lastClose: 2580, lastPrevClose: 2610, lastHigh: 2600, lastLow: 2560,
    marketCap: 255.581e12, float: 0.4052,
    peTTM: 15.39, pb: 1.90, roe: 0.1235, evEbitda: 4.00,
    netMargin: 0.25, dividendYield: 0.05,
    avg20dValue: 300e9,
    // flowBias: 12d sum = −374.3B → Distribusi
    // flowIntensity: avg |flow|/day = 31.2B / 300B avg20d = 10.4% → Ringan to Sedang;
    //   sustained 12 days → Sedang
    // flowReliability: 9/12 = 75% consistent + high foreign share 76% → Tinggi
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Sedang',
    flowReliability: 'Tinggi',
    foreignActivityData: flowSnap(-62.59e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'smart-money-exit / CAPITAL_FLIGHT',
    archetypeNote: 'Monotone sustained distribution over 12 days. Cleanest exit. Positive control.',
    expectAvoid: true,
  },

  // ── 2. BBRI — Heavy Sustained Distribution + Reversal Stress ─
  // 12-day sum = −3085.6B (!). 11/12 days negative.
  // CRITICAL: Jun17 = +456B single green print inside distribution.
  // Must NOT flip archetype → M14 reads Jun18=−557B (last day) and
  // correctly sees NO trailing streak. M12 last 5 days recency-weighted
  // by weight-5 on Jun18=−557B → strongly negative.
  // Expected: AVOID.
  {
    symbol: 'BBRI',
    sector: 'Financials',
    foreignFlowHistory: [
      -37.09e9, -427.54e9, -451.67e9, -110.79e9,
      -298.49e9, -476.87e9, -571.32e9, -203.70e9,
      -371.65e9, -35.31e9, +456.08e9, -557.26e9,
    ],
    priceOpen: 2940, priceClose: 2930, changePercent: -0.34,
    lastClose: 2930, lastPrevClose: 2960, lastHigh: 2970, lastLow: 2920,
    marketCap: 444.068e12, float: 0.4232,
    peTTM: 7.59, pb: 1.31, roe: 0.1730, evEbitda: 5.00,
    netMargin: null, dividendYield: 0.08,   // bank — netMargin n/a
    avg20dValue: 500e9,
    // flowBias: sum = −3085.6B → Distribusi
    // flowIntensity: avg = 257B/day / 500B = 51.4% → Besar
    // flowReliability: 11/12 = 91.7% consistent → Tinggi
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Besar',
    flowReliability: 'Tinggi',
    foreignActivityData: flowSnap(-557.26e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'heavy sustained distribution + reversal-stress',
    archetypeNote: 'Jun17 +456B must NOT flip M14/M16 to accumulation. Last day Jun18=−557B resets streak.',
    expectAvoid: true,
  },

  // ── 3. MDKA — Accumulation / Domestic-Led Markup ─────────────
  // 12-day sum = +95.5B. 6/12 days positive.
  // Pattern: strong front-load Jun2-4 (+240B), mid-window profit-
  // taking Jun5-12 (−197B), then recovery Jun15-18 (+52B).
  // Loss-making (PE=−70) → valuation layer returns low.
  // Expected: WATCHLIST (not BUY — mixed signals mid-window).
  {
    symbol: 'MDKA',
    sector: 'Materials',
    foreignFlowHistory: [
      +28.20e9, +112.18e9, +100.00e9, -97.11e9,
      -31.50e9, -52.09e9, -0.60803e9, -11.34e9,
      -4.62e9, +41.26e9, +10.02e9, +1.08e9,
    ],
    priceOpen: 2610, priceClose: 2970, changePercent: +13.79,
    lastClose: 2970, lastPrevClose: 2950, lastHigh: 2990, lastLow: 2940,
    marketCap: 71.706e12, float: 0.4778,
    peTTM: null, pb: 5.42, roe: -0.0773, evEbitda: 21.00,  // loss-making, PE invalid
    netMargin: null, dividendYield: 0,
    avg20dValue: 80e9,
    // flowBias: sum = +95.5B → Akumulasi
    // flowIntensity: avg = 8.0B/day / 80B = 10% → Ringan; but front 3 days avg=80B/day=100%
    //   → Sedang (mixed, front-loaded)
    // flowReliability: 6/12 = 50% consistent + mid-window reversal → Sedang
    flowBias: 'Akumulasi',
    flowIntensity: 'Akumulasi Sedang',
    flowReliability: 'Sedang',
    foreignActivityData: flowSnap(+1.08e9),
    brokerData: MDKA_BROKERS,
    expectedArchetype: 'accumulation / domestic-led markup with mid-window profit-taking',
    archetypeNote: 'WATCHLIST expected, not BUY. ROE negative → valuation drag. 50% flow consistency.',
    expectAvoid: false,
  },

  // ── 4. KLBF — Weak Distribution Accelerating Late ────────────
  // 12-day sum = −216.7B. 8/12 days negative. Late window heavy.
  // STALE STORED LABEL: stored=stealth-accum → IGNORE.
  // Actual June data = accelerating distribution (Jun15-18 = −180.7B total).
  // Expected: AVOID.
  {
    symbol: 'KLBF',
    sector: 'Health Care',
    foreignFlowHistory: [
      -17.45e9, -11.69e9, +6.50e9, +5.70e9,
      +4.10e9, +6.07e9, -22.74e9, -7.42e9,
      -26.54e9, -35.45e9, -77.52e9, -40.23e9,
    ],
    priceOpen: 710, priceClose: 704, changePercent: -0.85,
    lastClose: 704, lastPrevClose: 720, lastHigh: 725, lastLow: 700,
    marketCap: 32.769e12, float: 0.3830,
    peTTM: 9.06, pb: 1.35, roe: 0.1489, evEbitda: 6.00,
    netMargin: 0.12, dividendYield: 0.04,
    avg20dValue: 50e9,
    // flowBias: sum = −216.7B → Distribusi
    // flowIntensity: avg = 18.1B/day / 50B = 36.2%; late window avg = 45.2B/day = 90%
    //   → Sedang for full window (not labelling by late spike alone)
    // flowReliability: 8/12 = 66.7% → Sedang
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Sedang',
    flowReliability: 'Sedang',
    foreignActivityData: flowSnap(-40.23e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'weak-distribution accelerating late, low-conviction',
    archetypeNote: 'Stale stored label = stealth-accum. June flow strongly contradicts this.',
    expectAvoid: true,
  },

  // ── 5. HRUM — Neutral / Weak Distribution — Null Control ─────
  // 12-day sum = −24.8B. 9/12 days negative but mostly tiny flows.
  // Jun2 = −17.45B is a single outlier dominating the sum.
  // Low foreign share (~28%). Very thin float.
  // Expected: AVOID (low confidence — true null control).
  {
    symbol: 'HRUM',
    sector: 'Energy',
    foreignFlowHistory: [
      -17.45e9, +0.05614e9, -0.148e9, -1.26e9,
      +0.94445e9, +0.35962e9, -2.59e9, -0.16415e9,
      -1.62e9, -1.10e9, -1.22e9, -0.58876e9,
    ],
    priceOpen: 1055, priceClose: 1050, changePercent: -0.47,
    lastClose: 1050, lastPrevClose: 1055, lastHigh: 1060, lastLow: 1045,
    marketCap: 11.152e12, float: 0.1718,
    peTTM: 16.47, pb: 0.70, roe: 0.0426, evEbitda: 10.00,
    netMargin: 0.15, dividendYield: 0.05,
    avg20dValue: 12e9,
    // flowBias: sum = −24.8B → Distribusi (but dominated by single Jun2 outlier)
    // flowIntensity: avg = 2.1B/day / 12B = 17.2%; excluding Jun2 outlier = 0.67B/day = 5.6%
    //   → Ringan (noise-level flows outside outlier)
    // flowReliability: thin float + low foreign share → Rendah
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Ringan',
    flowReliability: 'Rendah',
    foreignActivityData: flowSnap(-0.58876e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'neutral / weak-distribution — low-confidence null control',
    archetypeNote: 'Thin float, low foreign share 28%. Jun2 outlier dominates sum. True null.',
    expectAvoid: true,
  },

  // ── 6. BREN — Weak Distribution / Outlier-in-Noise ───────────
  // 12-day sum = −290.8B. 8/12 days negative.
  // Jun4 = −146.75B = 50.5% of total in one day → single outlier.
  // THIN FLOAT 12.58% + extreme multiples (PE 213, EV/EBITDA 59).
  // STALE STORED LABEL: stored=smart-money-exit → IGNORE.
  // Engine must NOT classify whole window by the Jun4 spike alone.
  // Override layer must force LOW CONFIDENCE regardless of flow magnitude.
  // Expected: AVOID.
  {
    symbol: 'BREN',
    sector: 'Energy',
    foreignFlowHistory: [
      -68.65e9, +35.50e9, -146.75e9, -38.12e9,
      -29.34e9, -38.30e9, +21.58e9, +10.45e9,
      -2.98e9, -17.64e9, -18.72e9, +2.20e9,
    ],
    priceOpen: 4120, priceClose: 3750, changePercent: -8.98,
    lastClose: 3750, lastPrevClose: 3770, lastHigh: 3800, lastLow: 3730,
    marketCap: 499.023e12, float: 0.1258,
    peTTM: 213.30, pb: 43.14, roe: 0.2023, evEbitda: 59.00,
    netMargin: 0.20, dividendYield: 0.01,
    avg20dValue: 60e9,
    // flowBias: sum = −290.8B → Distribusi
    // flowIntensity: avg = 24.2B/day / 60B = 40.3%; but Jun4 alone = 146.75B.
    //   Excluding Jun4: avg = 13.1B/day = 21.8% → Sedang.
    //   Using Sedang to avoid outlier-driven Besar classification.
    // flowReliability: THIN FLOAT 12.58% + PE 213 + EV/EBITDA 59 → Rendah
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Sedang',
    flowReliability: 'Rendah',
    foreignActivityData: flowSnap(+2.20e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'weak-distribution / outlier-in-noise',
    archetypeNote: 'Jun4 −146.75B = 50% of total. Thin float (12.58%) forces low confidence. Stale label = smart-exit.',
    expectAvoid: true,
  },

  // ── 7. BUVA — THE PRIMARY TEST ────────────────────────────────
  // 12-day sum = −105.7B. 7/12 days negative.
  // V-shape price: 830 → ~565 → 870 (+4.82% net).
  // This is the stock whose M6 moved from flat-50 to 42.8–69.8 after the fix.
  // Three independent dampeners must prevent false-positive HIGH readiness:
  //   (1) Low foreign share: ~20-25% dominant ownership = domestic-driven
  //   (2) Choppy flow: Jun2 −72.2B + Jun10 −42.8B dominate; rest ±noise
  //   (3) No valuation anchor: PE=1077, EV/EBITDA=207 — extreme / meaningless
  // Last day Jun18 = +6.74B → M6 = 66.9 (looks positive).
  // But M12 last 5 days recency-weighted = −7.2B → score 32.0 (distribution).
  // Expected: AVOID, LOW readiness. HIGH = false positive = bug.
  {
    symbol: 'BUVA',
    sector: 'Real Estate',
    foreignFlowHistory: [
      -72.15e9, +17.78e9, -3.80e9, +12.53e9,
      +19.22e9, -2.60e9, -42.75e9, +9.52e9,
      -20.42e9, -8.48e9, -21.27e9, +6.74e9,
    ],
    priceOpen: 830, priceClose: 870, changePercent: +4.82,
    lastClose: 870, lastPrevClose: 855, lastHigh: 880, lastLow: 850,
    marketCap: 21.417e12, float: 0.3335,
    peTTM: 1077.59, pb: 10.49, roe: 0.0097, evEbitda: 207.00,
    netMargin: 0.01, dividendYield: 0.01,
    avg20dValue: 20e9,
    // flowBias: sum = −105.7B → Distribusi (but choppy; Jun2+Jun10 = −114.9B of total)
    // flowIntensity: avg = 8.8B/day / 20B = 44%; but without 2 outlier days: avg = 4B/day = 20%
    //   → Ringan (choppy, outlier-driven; intentionally understated for noise stocks)
    // flowReliability: extreme multiples (PE 1077) + choppy flow → Rendah
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Ringan',
    flowReliability: 'Rendah',
    foreignActivityData: flowSnap(+6.74e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'weak/low-conviction — primary fix validation (must stay LOW)',
    archetypeNote: 'M6 last-day = 66.9 (positive) but M12 recency-weighted = 32.0 (distribution). M8=0. HIGH readiness = false positive.',
    expectAvoid: true,
  },

  // ── 8. UNVR — Fading Distribution / Recency Decay Test ───────
  // 12-day sum = −50.4B. 7/12 days negative.
  // Pattern: front-loaded distribution Jun2-5 (−62.4B total = the signal),
  //   then decays to ±3-13B noise Jun8-18.
  // M12 recency weights [1,2,3,4,5] on last 5 days:
  //   [+0.37, −5.83, +13.32, −3.21, +2.20] → weightedAvg ≈ +1.8B →
  //   M12 ≈ 54.5 (slightly above neutral — LATE RECOVERY).
  // But M14: Jun18=+2.20, Jun17=−3.21 (breaks streak) → age=1 (FORMING, not reliable).
  // foreignSharePct falling over window (38→29) → Sedang reliability.
  // Expected: AVOID (despite M12 slight positive — overall distribution confirmed
  //   by early window + fading M6 regime history).
  {
    symbol: 'UNVR',
    sector: 'Consumer Staples',
    foreignFlowHistory: [
      -20.17e9, -15.90e9, -9.92e9, -16.38e9,
      +0.09458e9, -3.84e9, +8.85e9, +0.36669e9,
      -5.83e9, +13.32e9, -3.21e9, +2.20e9,
    ],
    priceOpen: 1710, priceClose: 1685, changePercent: -1.46,
    lastClose: 1685, lastPrevClose: 1680, lastHigh: 1700, lastLow: 1675,
    marketCap: 64.283e12, float: 0.1404,
    peTTM: 7.52, pb: 9.80, roe: 1.3025, evEbitda: 11.00,
    netMargin: 0.12, dividendYield: 0.13,
    avg20dValue: 20e9,
    // flowBias: sum = −50.4B → Distribusi
    // flowIntensity: avg = 4.2B/day / 20B = 21%; late window noise ~0-13B/day
    //   → Ringan (front-loaded, decaying)
    // flowReliability: foreignShare falling 38→29%; 7/12 negative = 58% consistent → Sedang
    flowBias: 'Distribusi',
    flowIntensity: 'Distribusi Ringan',
    flowReliability: 'Sedang',
    foreignActivityData: flowSnap(+2.20e9),
    brokerData: DIST_BROKERS,
    expectedArchetype: 'fading distribution / decay test',
    archetypeNote: 'Jun2-5 front-loaded (−62.4B). M12 recency-weighted late window ≈ +1.8B/day (decay). M14 age=1 (FORMING). AVOID expected.',
    expectAvoid: true,
  },
];

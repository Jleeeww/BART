import { TEST_SCENARIOS } from "./testScenarios";
import { getStockDecision } from "./unifiedDecision";
import { computeCompositeV3, type CompositeV3Input } from "./compositeEngineV3";
import { scoreInsider } from "./insiderScorer";
import type { InsiderTransaction } from "./insiderResearch";
import type { MacroRegime } from "./macroRegimeDetector";

// ── Locked composite calibration values (approved 2026-05-07, widened 2026-05-18 for Layer 7) ──
const COMPOSITE_CALIBRATION = [
  {
    name: "BBCA Composite Calibration",
    input: {
      symbol: "BBCA", sector: "Financials", bandarmologyScore: 62,
      isGorengan: false, peRatio: 28.5, dividendYield: 2.1,
      roe: 18.2, netMargin: 40.1,
    },
    expected: { compositeMin: 48, compositeMax: 62, bucket: "watchlist_prioritas" as const },
  },
  {
    name: "UNVR Composite Calibration",
    input: {
      symbol: "UNVR", sector: "Consumer Staples", bandarmologyScore: 5,
      isGorengan: false, peRatio: 35.0, dividendYield: 3.8,
      roe: 82.5, netMargin: 14.2,
    },
    expected: { compositeMin: 12, compositeMax: 25, bucket: "hindari_dulu" as const },
  },
];

// ── Mock insider transaction builder ───────────────────────────────────────────

function mockTx(overrides: Partial<InsiderTransaction>): InsiderTransaction {
  return {
    symbol:          "TEST",
    personName:      "Test Person",
    role:            "Direktur Utama",
    transactionType: "BUY",
    transactionDate: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
    filingDate:      new Date(Date.now() - 8  * 86_400_000).toISOString().slice(0, 10),
    filingDelayDays: 2,
    shares:          100_000,
    pricePerShare:   5_000,
    totalValue:      500_000_000,
    priceAtFiling:   5_000,
    source:          "https://idx.co.id/test",
    reliability:     "HIGH",
    ...overrides,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// ── Insider scorer test cases ─────────────────────────────────────────────────

interface InsiderTestCase {
  name: string;
  transactions: InsiderTransaction[];
  expected: {
    scoreMin:     number | null;
    scoreMax:     number | null;
    signal:       string;
    clusterBuy?:  boolean;
    priceContext?: boolean | null;
  };
}

const INSIDER_TESTS: InsiderTestCase[] = [
  {
    name: "Test 7 — INSIDER_CLUSTER_BUY",
    transactions: [
      // 3 different insiders, within 10 days, price was down (priceAtFiling > pricePerShare + 15%)
      mockTx({ personName: "Direktur A", transactionDate: daysAgo(12), filingDate: daysAgo(10), pricePerShare: 4_000, priceAtFiling: 4_700, totalValue: 400_000_000 }),
      mockTx({ personName: "Direktur B", transactionDate: daysAgo(8),  filingDate: daysAgo(6),  pricePerShare: 4_100, priceAtFiling: 4_700, totalValue: 410_000_000 }),
      mockTx({ personName: "Komisaris C", transactionDate: daysAgo(5), filingDate: daysAgo(3),  pricePerShare: 4_200, priceAtFiling: 4_700, totalValue: 420_000_000 }),
    ],
    expected: { scoreMin: 85, scoreMax: 100, signal: "STRONG_BUY", clusterBuy: true },
  },
  {
    name: "Test 8 — INSIDER_DISTRIBUTION",
    transactions: [
      // 4 sells, 1 buy, all into rising market (priceAtFiling < pricePerShare — no weakness)
      mockTx({ transactionType: "SELL", personName: "Direktur A", transactionDate: daysAgo(20), pricePerShare: 8_000, priceAtFiling: 7_500, totalValue: 800_000_000 }),
      mockTx({ transactionType: "SELL", personName: "Direktur B", transactionDate: daysAgo(15), pricePerShare: 7_900, priceAtFiling: 7_500, totalValue: 790_000_000 }),
      mockTx({ transactionType: "SELL", personName: "Komisaris C", transactionDate: daysAgo(10), pricePerShare: 7_800, priceAtFiling: 7_500, totalValue: 780_000_000 }),
      mockTx({ transactionType: "SELL", personName: "Komisaris D", transactionDate: daysAgo(5),  pricePerShare: 7_700, priceAtFiling: 7_500, totalValue: 770_000_000 }),
      mockTx({ transactionType: "BUY",  personName: "Direktur E", transactionDate: daysAgo(25), pricePerShare: 7_500, priceAtFiling: 7_500, totalValue: 150_000_000 }),
    ],
    expected: { scoreMin: 10, scoreMax: 30, signal: "STRONG_SELL" },
  },
  {
    name: "Test 9 — INSIDER_INSUFFICIENT",
    transactions: [
      // Only 1 transaction in 90 days
      mockTx({ transactionType: "BUY", personName: "Direktur A", transactionDate: daysAgo(5) }),
    ],
    expected: { scoreMin: null, scoreMax: null, signal: "INSUFFICIENT_DATA" },
  },
];

// ── Macro regime test cases ───────────────────────────────────────────────────

function mockRegime(overrides: Partial<MacroRegime>): MacroRegime {
  return {
    regime: 'NEUTRAL', multiplier: 1.0, confidence: 50,
    triggers: [], durationDays: 0, note: '',
    ...overrides,
  };
}

interface MacroRegimeTestCase {
  name:  string;
  input: CompositeV3Input;
  expected: {
    compositeMin?: number;
    compositeMax:  number;
    hasFlag?:      string;
  };
}

const MACRO_REGIME_TESTS: MacroRegimeTestCase[] = [
  {
    name: "Test 10 — CAPITAL_FLIGHT_OVERRIDE",
    input: {
      symbol: "TEST_CF", sector: null, isGorengan: false,
      bandarmologyScore: 90,
      peRatio: 15, dividendYield: 4.0, roe: 25, netMargin: 35,
      mockRegime: mockRegime({ regime: 'CAPITAL_FLIGHT', multiplier: 0.6, confidence: 85,
        triggers: ['Aliran asing -800 M IDR', 'CDS naik 45bps'], durationDays: 15 }),
    },
    expected: { compositeMax: 50, hasFlag: 'MACRO_CAPITAL_FLIGHT' },
  },
  {
    name: "Test 11 — CAPITAL_INFLOW_AMPLIFY",
    input: {
      symbol: "TEST_CI", sector: null, isGorengan: false,
      bandarmologyScore: 60,
      peRatio: null, dividendYield: null, roe: null, netMargin: null,
      mockRegime: mockRegime({ regime: 'CAPITAL_INFLOW', multiplier: 1.15, confidence: 70,
        triggers: ['Aliran asing +500 M IDR'], durationDays: 10 }),
    },
    expected: { compositeMin: 66, compositeMax: 72 },
  },
  {
    name: "Test 12 — INSUFFICIENT_DATA_DEFAULT",
    input: {
      symbol: "TEST_ID", sector: null, isGorengan: false,
      bandarmologyScore: 60,
      peRatio: null, dividendYield: null, roe: null, netMargin: null,
      mockRegime: mockRegime({ regime: 'INSUFFICIENT_DATA', multiplier: 1.0 }),
    },
    expected: { compositeMin: 58, compositeMax: 62 },
  },
];

// ── Composite tests with insider integration ──────────────────────────────────

export async function runEngineTests() {
  const results = TEST_SCENARIOS.map((s) => {
    const result = getStockDecision(s.input);

    const readinessOk =
      result.readiness >= s.expected.readinessMin &&
      result.readiness <= s.expected.readinessMax;

    const actionOk = result.action === s.expected.action;

    return {
      scenario: s.name,
      readiness: result.readiness,
      action: result.action,
      bucket: result.bucket,
      expected: s.expected,
      pass: readinessOk && actionOk,
      issues: {
        readiness: readinessOk ? null : `Got ${result.readiness}, expected ${s.expected.readinessMin}-${s.expected.readinessMax}`,
        action: actionOk ? null : `Got ${result.action}, expected ${s.expected.action}`,
      },
    };
  });

  const compositeResults = COMPOSITE_CALIBRATION.map((s) => {
    const result = computeCompositeV3(s.input);
    const compositeOk =
      result.compositeScore >= s.expected.compositeMin &&
      result.compositeScore <= s.expected.compositeMax;
    const bucketOk = result.homepageBucket === s.expected.bucket;

    return {
      scenario: s.name,
      compositeScore: result.compositeScore,
      bucket: result.homepageBucket,
      pass: compositeOk && bucketOk,
      issues: {
        composite: compositeOk
          ? null
          : `Got ${result.compositeScore}, expected ${s.expected.compositeMin}-${s.expected.compositeMax}`,
        bucket: bucketOk
          ? null
          : `Got ${result.homepageBucket}, expected ${s.expected.bucket}`,
      },
    };
  });

  // ── Insider scorer unit tests ───────────────────────────────────────────────
  const insiderResults = await Promise.all(INSIDER_TESTS.map(async (t) => {
    const result = await scoreInsider(t.transactions, "TEST");

    const scoreOk = t.expected.scoreMin === null
      ? result.score === null
      : result.score !== null &&
        result.score >= t.expected.scoreMin &&
        result.score <= t.expected.scoreMax!;

    const signalOk  = result.signal === t.expected.signal;
    const clusterOk = t.expected.clusterBuy === undefined || result.clusterBuySignal === t.expected.clusterBuy;
    const contextOk = t.expected.priceContext === undefined || result.priceContextSignal === t.expected.priceContext;

    const pass = scoreOk && signalOk && clusterOk && contextOk;

    return {
      scenario:      t.name,
      score:         result.score,
      signal:        result.signal,
      clusterBuy:    result.clusterBuySignal,
      priceContext:  result.priceContextSignal,
      pass,
      issues: {
        score:   scoreOk   ? null : `Got ${result.score}, expected ${t.expected.scoreMin}-${t.expected.scoreMax}`,
        signal:  signalOk  ? null : `Got ${result.signal}, expected ${t.expected.signal}`,
        cluster: clusterOk ? null : `Got clusterBuy=${result.clusterBuySignal}, expected ${t.expected.clusterBuy}`,
        context: contextOk ? null : `Got priceContext=${result.priceContextSignal}, expected ${t.expected.priceContext}`,
      },
    };
  }));

  const macroRegimeResults = MACRO_REGIME_TESTS.map((t) => {
    const result     = computeCompositeV3(t.input);
    const compositeOk =
      result.compositeScore <= t.expected.compositeMax &&
      (t.expected.compositeMin === undefined || result.compositeScore >= t.expected.compositeMin);
    const flagOk = !t.expected.hasFlag || result.activeFlags.includes(t.expected.hasFlag);
    const pass   = compositeOk && flagOk;

    return {
      scenario:       t.name,
      compositeScore: result.compositeScore,
      activeFlags:    result.activeFlags,
      pass,
      issues: {
        composite: compositeOk ? null : `Got ${result.compositeScore}, expected ${t.expected.compositeMin ?? 0}-${t.expected.compositeMax}`,
        flag:      flagOk      ? null : `Missing flag ${t.expected.hasFlag}, got [${result.activeFlags.join(', ')}]`,
      },
    };
  });

  const allResults = [
    ...results.map((r)            => ({ ...r, suite: "bandarmology" })),
    ...compositeResults.map((r)    => ({ ...r, suite: "composite_calibration" })),
    ...insiderResults.map((r)      => ({ ...r, suite: "insider_scorer" })),
    ...macroRegimeResults.map((r)  => ({ ...r, suite: "macro_regime" })),
  ];

  return {
    total:   allResults.length,
    passed:  allResults.filter((r) => r.pass).length,
    failed:  allResults.filter((r) => !r.pass).length,
    results: allResults,
  };
}

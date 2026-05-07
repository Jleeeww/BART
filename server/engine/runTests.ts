import { TEST_SCENARIOS } from "./testScenarios";
import { getStockDecision } from "./unifiedDecision";
import { computeCompositeV3 } from "./compositeEngineV3";

// ── Locked composite calibration values (approved 2026-05-07) ──
const COMPOSITE_CALIBRATION = [
  {
    name: "BBCA Composite Calibration",
    input: {
      symbol: "BBCA", sector: "Financials", bandarmologyScore: 62,
      isGorengan: false, peRatio: 28.5, dividendYield: 2.1,
      roe: 18.2, netMargin: 40.1,
    },
    expected: { compositeMin: 50, compositeMax: 58, bucket: "watchlist_prioritas" as const },
  },
  {
    name: "UNVR Composite Calibration",
    input: {
      symbol: "UNVR", sector: "Consumer Staples", bandarmologyScore: 5,
      isGorengan: false, peRatio: 35.0, dividendYield: 3.8,
      roe: 82.5, netMargin: 14.2,
    },
    expected: { compositeMin: 15, compositeMax: 25, bucket: "hindari_dulu" as const },
  },
];

export function runEngineTests() {
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

  const allResults = [
    ...results.map((r) => ({ ...r, suite: "bandarmology" })),
    ...compositeResults.map((r) => ({ ...r, suite: "composite_calibration" })),
  ];

  return {
    total: allResults.length,
    passed: allResults.filter((r) => r.pass).length,
    failed: allResults.filter((r) => !r.pass).length,
    results: allResults,
  };
}

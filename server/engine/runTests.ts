import { TEST_SCENARIOS } from "./testScenarios";
import { getStockDecision } from "./unifiedDecision";

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

  return {
    total: results.length,
    passed: results.filter((r) => r.pass).length,
    failed: results.filter((r) => !r.pass).length,
    results,
  };
}

export const TEST_SCENARIOS = [
  {
    name: "Active Accumulation",
    input: {
      netFlow: "high" as const,
      brokerStability: "high" as const,
      flowQuality: "high" as const,
      priceTrend: "up" as const,
      volatility: "low" as const,
      insider: "buy" as const,
      isGorengan: false,
    },
    expected: {
      readinessMin: 80,
      readinessMax: 100,
      action: "BUY" as const,
    },
  },
  {
    name: "Accumulation No Momentum",
    input: {
      netFlow: "high" as const,
      brokerStability: "high" as const,
      flowQuality: "high" as const,
      priceTrend: "sideways" as const,
      volatility: "low" as const,
      insider: "neutral" as const,
      isGorengan: false,
    },
    expected: {
      readinessMin: 70,
      readinessMax: 95,
      action: "WATCHLIST" as const,
    },
  },
  {
    name: "Distribution",
    input: {
      netFlow: "low" as const,
      brokerStability: "medium" as const,
      flowQuality: "low" as const,
      priceTrend: "up" as const,
      volatility: "high" as const,
      insider: "sell" as const,
      isGorengan: false,
    },
    expected: {
      readinessMin: 0,
      readinessMax: 60,
      action: "AVOID" as const,
    },
  },
  {
    name: "Gorengan Pump",
    input: {
      netFlow: "high" as const,
      brokerStability: "low" as const,
      flowQuality: "low" as const,
      priceTrend: "up" as const,
      volatility: "high" as const,
      insider: "neutral" as const,
      isGorengan: true,
    },
    expected: {
      readinessMin: 0,
      readinessMax: 59,
      action: "AVOID" as const,
    },
  },
];

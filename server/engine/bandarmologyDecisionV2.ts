import type { BandarmologyV2Result } from "./bandarmologyCore";

export function getBandarmologyDecisionV2(result: BandarmologyV2Result): {
  decision: "WATCHLIST_PRIORITAS" | "SIAP_DIPANTAU" | "HINDARI_DULU" | "NETRAL";
  compositeScore: number;
  regime: string | null;
} {
  const score = result.composite.score ?? 0;
  const regime = result.M16_regimeStability?.regime ?? null;

  let decision: "WATCHLIST_PRIORITAS" | "SIAP_DIPANTAU" | "HINDARI_DULU" | "NETRAL" = "NETRAL";

  if (score >= 70 && regime === "ACCUMULATION") {
    decision = "WATCHLIST_PRIORITAS";
  } else if (score >= 55) {
    decision = "SIAP_DIPANTAU";
  } else if (score < 40) {
    decision = "HINDARI_DULU";
  }

  return {
    decision,
    compositeScore: score,
    regime,
  };
}

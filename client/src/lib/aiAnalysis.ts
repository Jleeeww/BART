export interface AIAnalysisPayload {
  stock: string;
  date: string;
  context: string;
  price_context: {
    last_price: number;
    d1_change_pct: number;
    volume_vs_avg: number;
  };
  flow_signals: {
    net_foreign_buy_idr: number;
    net_domestic_buy_idr: number;
    flow_bias: string;
    flow_intensity: string;
    flow_reliability: string;
    buy_avg_price: number;
    sell_avg_price: number;
  };
  fundamentals: {
    roe: number;
    net_margin: number;
    yoy_profit_growth_pct: number;
    capital_adequacy: string;
  };
  event_specifics: {
    event_type: string;
    headline: string;
  };
}

export interface AIAnalysisResponse {
  flow_analysis: string;
  event_analysis: {
    impact: string;
    relevance: string;
    thesis: string;
    confidence: string;
    conditions: string;
  };
  risk_analysis: string;
}

export async function fetchAIAnalysis(payload: AIAnalysisPayload): Promise<AIAnalysisResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AI analysis failed: ${res.statusText}`);
  }

  return res.json();
}

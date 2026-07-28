import { useQuery } from "@tanstack/react-query";
import { api, buildUrl, type StockResponse } from "@shared/routes";

export interface PartialQuote {
  symbol: string;
  companyName: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
  description: string | null;
  peRatio: number | null;
  pbv: number | null;
  dividendYield: number | null;
  roe: number | null;
}

export type UseStockResult =
  | { kind: "full"; data: StockResponse }
  | { kind: "partial"; data: PartialQuote }
  | { kind: "missing" };

// GET /api/stocks/:symbol, falling back to GET /api/quote/:symbol (Yahoo-only,
// no DB seed) for tickers outside the curated 45-stock universe.
export function useStock(symbol: string) {
  return useQuery<UseStockResult>({
    queryKey: [api.stocks.getBySymbol.path, symbol],
    queryFn: async () => {
      const url = buildUrl(api.stocks.getBySymbol.path, { symbol });
      const res = await fetch(url);

      if (res.ok) {
        const data = api.stocks.getBySymbol.responses[200].parse(await res.json());
        return { kind: "full", data };
      }
      if (res.status !== 404) throw new Error("Failed to fetch stock data");

      const quoteRes = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
      if (!quoteRes.ok) return { kind: "missing" };
      const data = (await quoteRes.json()) as PartialQuote;
      return { kind: "partial", data };
    },
    // Refresh frequently for stock data
    refetchInterval: 60000,
  });
}

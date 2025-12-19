import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

// GET /api/stocks/:symbol
export function useStock(symbol: string) {
  return useQuery({
    queryKey: [api.stocks.getBySymbol.path, symbol],
    queryFn: async () => {
      const url = buildUrl(api.stocks.getBySymbol.path, { symbol });
      const res = await fetch(url);
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch stock data");
      
      // We parse manually here or use the schema if desired, 
      // but the route contract guarantees the shape.
      return api.stocks.getBySymbol.responses[200].parse(await res.json());
    },
    // Refresh frequently for stock data
    refetchInterval: 60000, 
  });
}

import { z } from 'zod';
import { insertStockSchema, stocks } from './schema';

export const errorSchemas = {
  notFound: z.object({
    message: z.string(),
  }),
};

export const api = {
  stocks: {
    getBySymbol: {
      method: 'GET' as const,
      path: '/api/stocks/:symbol',
      responses: {
        200: z.object({
          id: z.number(),
          symbol: z.string(),
          name: z.string(),
          price: z.string(),
          change: z.string(),
          changePercent: z.string(),
          summary: z.string(),
          description: z.string(),
          sector: z.string(),
          subsector: z.string(),
          marketCap: z.string(),
          peRatio: z.string(),
          dividendYield: z.string(),
          roe: z.string(),
          netMargin: z.string(),
          growth: z.string(),
          investorView: z.string(),
          financialSummary: z.string(),
          revenue2023: z.string(),
          revenue2024: z.string(),
          revenue2025: z.string(),
          netProfit2023: z.string(),
          netProfit2024: z.string(),
          netProfit2025: z.string(),
          assets2023: z.string(),
          assets2024: z.string(),
          assets2025: z.string(),
          liabilities2023: z.string(),
          liabilities2024: z.string(),
          liabilities2025: z.string(),
          ocf2023: z.string(),
          ocf2024: z.string(),
          ocf2025: z.string(),
          tradingActivitySummary: z.string(),
          flowReliability: z.string(),
          brokerData: z.string(),
          aiConfidence: z.enum(["High", "Medium", "Low"]),
          updatedAt: z.string().nullable(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type StockResponse = z.infer<typeof api.stocks.getBySymbol.responses[200]>;

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
          marketCap: z.string(),
          peRatio: z.string(),
          dividendYield: z.string(),
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

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
        200: z.custom<typeof stocks.$inferSelect>(),
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

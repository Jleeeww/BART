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
          flowOverviewSummary: z.string(),
          flowBias: z.string(),
          flowReliability: z.string(),
          flowIntensity: z.string(),
          brokerData: z.string(),
          foreignActivityData: z.string(),
          avgBuyPrice: z.string(),
          avgSellPrice: z.string(),
          newsOverviewSummary: z.string(),
          newsImpact: z.string(),
          newsRelevance: z.string(),
          newsFeed: z.string(),
          corporateActions: z.string(),
          investorInterpretation: z.string(),
          eventAnalysis: z.string(),
          financialsAnalystView: z.string(),
          flowAnalystView: z.string(),
          riskAnalystView: z.string(),
          riskData: z.string(),
          aiConfidence: z.string(),
          // IDX-specific fields
          idxIndices: z.string().nullable(),
          sectorBadge: z.string().nullable(),
          stockTags: z.string().nullable(),
          stockCharacter: z.string().nullable(),
          stockCharacterDesc: z.string().nullable(),
          retailSentiment: z.string().nullable(),
          foreignDomesticInterpretation: z.string().nullable(),
          localRiskFactors: z.string().nullable(),
          retailSummary: z.string().nullable(),
          insiderData: z.string().nullable(),
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

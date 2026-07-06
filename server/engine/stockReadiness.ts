/**
 * stockReadiness.ts — single canonical composite computation entry point.
 *
 * Both the bulk endpoint (/api/stocks) and the detail endpoint (/api/ai)
 * MUST call computeStockReadiness() to guarantee identical composite scores
 * regardless of which page a user views.
 *
 * Replaces the previously duplicated blocks in routes.ts that called
 * computeGorenganFromStock + getStockDecision + computeM17 + computeCompositeV3
 * separately with different arguments in each endpoint.
 */

import { computeGorenganFromStock, type GorenganResult } from './gorenganDetector';
import { mapStockDataToInput, getStockDecision, type StockDecisionResult } from './unifiedDecision';
import { computeM17 } from './bandarmologyExtensions';
import { computeCompositeV3, type CompositeV3Result } from './compositeEngineV3';

export interface StockReadinessInput {
  symbol:               string;
  sector:               string | null;
  changePercent:        string | number | null;
  flowBias:             string | null;
  flowIntensity:        string | null;
  flowReliability:      string | null;
  brokerData:           string | null;
  foreignActivityData:  string | null;
  stockCharacter:       string | null;
  insiderData:          string | null;
  growth:               string | null;
  peRatio:              string | number | null;
  dividendYield:        string | number | null;
  roe:                  string | number | null;
  netMargin:            string | number | null;
  marketCap:            string | null;
  avg20dValue:          number | null;
}

export interface StockReadinessResult extends CompositeV3Result {
  isGorengan:        boolean;
  gorenganResult:    GorenganResult;
  bandarmologyScore: number;
  decision:          StockDecisionResult;
}

const safeNum = (v: string | number | null | undefined): number | null => {
  const n = parseFloat(String(v ?? ''));
  return isFinite(n) ? n : null;
};

export function computeStockReadiness(stock: StockReadinessInput): StockReadinessResult {
  // Step 1 — Gorengan detection (with marketCap for the >5T exemption)
  const gorenganResult = computeGorenganFromStock({
    symbol:              stock.symbol,
    changePercent:       String(stock.changePercent ?? '0'),
    flowBias:            stock.flowBias  ?? 'Netral',
    flowIntensity:       stock.flowIntensity  ?? 'Tidak Ada Data',
    flowReliability:     stock.flowReliability ?? 'Rendah',
    brokerData:          stock.brokerData ?? '[]',
    foreignActivityData: stock.foreignActivityData ?? '{}',
    stockCharacter:      stock.stockCharacter ?? null,
    marketCap:           stock.marketCap ?? null,
  });

  // Step 2 — Unified brain decision (determines bandarmologyScore)
  const brainInput = mapStockDataToInput({
    flowBias:            stock.flowBias,
    flowIntensity:       stock.flowIntensity,
    flowReliability:     stock.flowReliability,
    changePercent:       stock.changePercent,
    growth:              stock.growth,
    insiderData:         stock.insiderData,
    brokerData:          stock.brokerData,
    foreignActivityData: stock.foreignActivityData,
    stockCharacter:      stock.stockCharacter,
    isGorengan:          gorenganResult.isGorengan,
  });
  const decision = getStockDecision(brainInput);

  // Step 3 — M17 extension (smart/dumb money divergence)
  const stockBrokers = (() => {
    try { return JSON.parse(stock.brokerData ?? '[]'); } catch { return []; }
  })();
  const m17Result = computeM17(stockBrokers, stock.avg20dValue ?? null);

  // Step 4 — Composite v3 (7-layer weighted score)
  const compositeResult = computeCompositeV3({
    symbol:            stock.symbol,
    sector:            stock.sector,
    bandarmologyScore: decision.readiness,
    isGorengan:        gorenganResult.isGorengan,
    peRatio:           safeNum(stock.peRatio),
    dividendYield:     safeNum(stock.dividendYield),
    roe:               safeNum(stock.roe),
    netMargin:         safeNum(stock.netMargin),
    extensionScores: {
      m17Score:   m17Result.score,
      m18GapPct:  null,
      m24Score:   null,
    },
  });

  return {
    ...compositeResult,
    isGorengan:        gorenganResult.isGorengan,
    gorenganResult,
    bandarmologyScore: decision.readiness,
    decision,
  };
}

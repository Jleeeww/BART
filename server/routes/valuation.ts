import type { Express } from "express";
import { storage } from "../storage";
import { getStockDecision, mapStockDataToInput } from "../engine/unifiedDecision";
import { computeGorenganFromStock } from "../engine/gorenganDetector";

export function registerValuationRoutes(app: Express): void {
  app.get('/api/valuation/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: 'Symbol required' });

      const stock = await storage.getStockBySymbol(symbol);
      if (!stock) return res.status(404).json({ error: 'Stock not found' });

      const { computeValuation } = await import('../engine/valuationEngine');
      const { computeSynthesis }  = await import('../engine/synthesisEngine');

      const safeParse = (v: any): number | null => { const n = parseFloat(String(v)); return isFinite(n) ? n : null; };
      const valuationOutput = computeValuation({
        peRatio:       safeParse(stock.peRatio),
        dividendYield: safeParse(stock.dividendYield),
        roe:           safeParse(stock.roe),
        netMargin:     safeParse(stock.netMargin),
        sector:        stock.sector ?? null,
      });

      const gorenganResult = computeGorenganFromStock({
        symbol,
        changePercent: stock.changePercent || "0",
        flowBias: stock.flowBias || "Netral",
        flowIntensity: stock.flowIntensity || "",
        flowReliability: stock.flowReliability || "Rendah",
        brokerData: stock.brokerData || "[]",
        foreignActivityData: stock.foreignActivityData || "{}",
        stockCharacter: stock.stockCharacter,
      });
      const brainInput = mapStockDataToInput({
        flowBias: stock.flowBias,
        flowIntensity: stock.flowIntensity,
        flowReliability: stock.flowReliability,
        changePercent: stock.changePercent,
        growth: stock.growth,
        insiderData: stock.insiderData,
        brokerData: stock.brokerData,
        foreignActivityData: stock.foreignActivityData,
        stockCharacter: stock.stockCharacter,
        isGorengan: gorenganResult.isGorengan,
      });
      const decision = getStockDecision(brainInput);

      const synthesis = computeSynthesis({
        bandarmologyDecision: decision.actionState,
        bandarmologyScore: decision.readiness,
        flowBias: stock.flowBias,
        valuationOutput,
      });

      res.status(200).json({
        symbol,
        valuation: valuationOutput,
        synthesis,
        sectorBenchmark: valuationOutput.valuation.sectorBenchmark,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[/api/valuation] Error for ${req.params.symbol}:`, message);
      res.status(500).json({ error: 'Valuation engine error', message });
    }
  });
}

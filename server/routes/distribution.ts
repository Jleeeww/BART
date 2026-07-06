import type { Express } from "express";
import { storage } from "../storage";

export function registerDistributionRoutes(app: Express): void {
  app.get('/api/distribution/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: 'Symbol required' });

      const stock = await storage.getStockBySymbol(symbol);
      if (!stock) return res.status(404).json({ error: 'Stock not found' });

      const { computeDistributionWarningFromDB } =
        await import('../engine/distributionWarning');

      const stockData = stock as any;
      const cyclePosition = stockData.cyclePosition ?? null;
      const campaignAge   = stockData.campaignAge   ?? null;

      const parseNum = (v: any): number | null => {
        if (v === null || v === undefined) return null;
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return isFinite(n) ? n : null;
      };

      const result = await computeDistributionWarningFromDB(symbol, {
        cyclePosition,
        campaignAge,
        compositeScore:    parseNum(stockData.readinessScore),
        m6Score:           parseNum(stockData.m6Score),
        m15Score:          parseNum(stockData.m15Score),
        m11AlignmentScore: parseNum(stockData.m11Alignment),
        brokerData:        stockData.brokerData ?? null,
      });

      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}

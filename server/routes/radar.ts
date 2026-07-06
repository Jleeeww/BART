import type { Express } from "express";
import { storage } from "../storage";

export function registerRadarRoutes(app: Express): void {
  app.get('/api/radar', async (req, res) => {
    try {
      const { getRadarResults } = await import('../engine/radarEngine');
      const allStocks = await storage.getAllStocks();

      if (!allStocks || allStocks.length === 0) {
        return res.status(200).json({
          stocks: [],
          hiddenCount: 0,
          errorCount: 0,
          totalProcessed: 0,
          cacheTimestamp: new Date().toISOString(),
          isStale: false,
          nextRefreshAt: new Date().toISOString(),
        });
      }

      const mappedStocks = allStocks.map((s: any) => ({
        ...s,
        companyName: s.name || s.symbol,
      }));
      const result = await getRadarResults(mappedStocks as any);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[/api/radar] Error:', message);
      res.status(500).json({
        error: 'Radar engine error',
        message,
        stocks: []
      });
    }
  });

  app.get('/api/radar/status', async (req, res) => {
    try {
      const { getRadarCacheStatus } = await import('../engine/radarEngine');
      res.status(200).json(getRadarCacheStatus());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

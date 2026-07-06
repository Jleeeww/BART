import type { Express } from "express";

export function registerMacroRoutes(app: Express): void {
  app.get('/api/alt-data/status', async (req, res) => {
    try {
      const { getAltDataStatus } = await import('../engine/altDataFetcher');
      res.status(200).json(getAltDataStatus());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/alt-data/snapshot', async (req, res) => {
    try {
      const { getAltDataSnapshot } = await import('../engine/altDataFetcher');
      const snapshot = await getAltDataSnapshot();
      res.status(200).json(snapshot);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Cache-aware: skips the internal /api/stocks fetch when the engine cache is still warm.
  app.get('/api/sector-rotation', async (req, res) => {
    try {
      const { computeSectorRotation, getCachedSectorRotation } =
        await import('../engine/sectorRotationEngine');

      const cached = getCachedSectorRotation();
      if (cached) {
        return res.status(200).json(cached);
      }

      const port = process.env.PORT || 3000;
      const stocksRes = await fetch(`http://localhost:${port}/api/stocks`);
      if (!stocksRes.ok) throw new Error(`Failed to fetch /api/stocks: ${stocksRes.status}`);
      const allStocks = await stocksRes.json();
      const snapshot = await computeSectorRotation(allStocks as any[]);
      res.status(200).json(snapshot);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/macro/regime', async (_req, res) => {
    try {
      const { getCachedMacroRegime, computeMacroRegime } = await import('../engine/macroRegimeDetector');
      const cached = getCachedMacroRegime();
      const regime = cached.regime !== 'INSUFFICIENT_DATA'
        ? cached
        : await computeMacroRegime().catch(() => cached);

      const { pool } = await import('../db');
      const history = await pool.query(
        `SELECT date, regime, multiplier, confidence, triggers, duration_days AS "durationDays"
         FROM macro_regime_history
         ORDER BY date DESC LIMIT 30`
      ).catch(() => ({ rows: [] as any[] }));

      res.json({ current: regime, history: history.rows });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/macro/flow', async (_req, res) => {
    try {
      const { pool } = await import('../db');
      const rows = await pool.query(
        `SELECT date,
                ihsg_foreign AS "ihsgForeignNetFlow",
                indogb_ust   AS "indogbUstSpread",
                indo_cds     AS "indo5yCDS",
                eido_volume  AS "eidoVolume",
                eido_change  AS "eidoChange",
                data_quality AS "dataQuality",
                fetched_at   AS "fetchedAt"
         FROM macro_flow_history
         ORDER BY date DESC LIMIT 30`
      );
      res.json({ snapshots: rows.rows, count: rows.rows.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/macro-context', async (req, res) => {
    try {
      const { getMacroContext } = await import('../engine/macroContext');
      const { getAltDataSnapshot } = await import('../engine/altDataFetcher');

      const altData = await getAltDataSnapshot();
      const cpoTrend  = altData.cpo.trend;
      const coalTrend = altData.coal.trend;

      const result = await getMacroContext(cpoTrend, coalTrend);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

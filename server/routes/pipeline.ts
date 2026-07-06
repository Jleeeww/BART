import type { Express } from "express";

export function registerPipelineRoutes(app: Express): void {
  app.get('/api/history/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: 'Symbol required' });
      const { getHistoryStatus } = await import('../engine/historyBuilder');
      const status = await getHistoryStatus(symbol);
      res.status(200).json({ symbol, ...status });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/ingest', async (req, res) => {
    try {
      const authHeader = req.headers.authorization ?? '';
      const token = authHeader.replace('Bearer ', '');
      const expectedToken = process.env.INGEST_SECRET;
      if (!expectedToken) {
        return res.status(503).json({ error: 'Ingest endpoint not configured' });
      }

      if (token !== expectedToken) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const payload = req.body;
      if (!payload?.stocks || !Array.isArray(payload.stocks)) {
        return res.status(400).json({ error: 'Invalid payload' });
      }

      const { ingestSession } = await import('../engine/idxIngester');
      const result = await ingestSession(payload);
      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[/api/ingest] Error:', message);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/monitor/scores', async (req, res) => {
    try {
      const { getLastDistribution } = await import('../engine/scoreMonitor');
      res.status(200).json(getLastDistribution());
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

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

  // Manually trigger OHLCV ingestion (dev/on-demand). Body: { symbols?, rangeDays? }.
  // Defaults to the homepage universe. Pulls live from Yahoo → session_history.
  app.post('/api/ingest/ohlcv', async (req, res) => {
    try {
      const { ingestOHLCVBatch } = await import('../engine/ohlcvIngester');
      const { HOMEPAGE_UNIVERSE } = await import('../engine/lq45Universe');
      const symbols: string[] = Array.isArray(req.body?.symbols) && req.body.symbols.length
        ? req.body.symbols.map((s: string) => String(s).toUpperCase())
        : HOMEPAGE_UNIVERSE;
      const rangeDays = Number(req.body?.rangeDays) || 40;
      const result = await ingestOHLCVBatch(symbols, rangeDays);
      const { invalidateRadarCache } = await import('../engine/radarEngine');
      invalidateRadarCache();
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Manually refresh stocks table price + ratios from official IDX data.
  app.post('/api/ingest/fundamentals', async (_req, res) => {
    try {
      const { updateStocksFromIDX } = await import('../engine/idxFundamentalsIngester');
      const result = await updateStocksFromIDX();
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Per-stock bandarmology from Stockbit (broker net buy/sell, foreign/domestic).
  app.get('/api/bandarmology/:symbol', async (req, res) => {
    try {
      const { getBandarmology } = await import('../engine/stockbitBandarmology');
      const b = await getBandarmology(req.params.symbol);
      if (!b) return res.status(404).json({ error: 'No bandarmology data', symbol: req.params.symbol });
      res.json(b);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // One broker's daily net value/lot history for one stock (Broker Daily Activity).
  app.get('/api/bandarmology/:symbol/broker/:brokerCode/history', async (req, res) => {
    try {
      const { getBrokerHistory } = await import('../engine/stockbitBandarmology');
      const limit = Math.min(Number(req.query.limit) || 90, 365);
      const history = await getBrokerHistory(req.params.symbol, req.params.brokerCode, limit);
      res.json({ symbol: req.params.symbol.toUpperCase(), broker: req.params.brokerCode.toUpperCase(), history });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Trigger the full broker sweep → ingest into session_history.
  app.post('/api/ingest/bandarmology', async (_req, res) => {
    try {
      const { ingestBandarmology } = await import('../engine/stockbitBandarmology');
      const result = await ingestBandarmology();
      if (!result) return res.status(503).json({ error: 'Stockbit not configured (STOCKBIT_TOKEN)' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
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

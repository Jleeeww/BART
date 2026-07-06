import type { Express } from "express";

export function registerScraperRoutes(app: Express): void {
  // POST /api/scraper/ingest — trigger on-demand broker data ingest for given symbols
  app.post('/api/scraper/ingest', async (req, res) => {
    try {
      const { symbols } = req.body as { symbols?: unknown };
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'symbols array required' });
      }
      const clean = symbols
        .map((s) => String(s).toUpperCase().trim())
        .filter((s) => /^[A-Z0-9]{1,6}$/.test(s))
        .slice(0, 50); // hard cap per request
      if (clean.length === 0) {
        return res.status(400).json({ error: 'no valid symbols after sanitisation' });
      }
      const { ingestBrokerData } = await import('../scrapers/brokerIngestor');
      const summary = await ingestBrokerData(clean);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/scraper/status — last N scrape_log entries
  app.get('/api/scraper/status', async (_req, res) => {
    try {
      const { pool } = await import('../db');
      const rows = await pool.query(
        `SELECT id, run_at, attempted, succeeded, failed, duration_ms, source_breakdown
         FROM scrape_log ORDER BY run_at DESC LIMIT 20`
      );
      res.json({ runs: rows.rows, count: rows.rows.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

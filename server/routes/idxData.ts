import type { Express } from "express";

/**
 * Official IDX market-data routes (financial ratios, announcements, indices,
 * daily movers, dividends). Engines lazy-imported so a fetch failure can't
 * crash startup; all handlers return graceful fallbacks.
 */
export function registerIdxDataRoutes(app: Express): void {
  // Per-stock financial ratios (PER/PBV/DER/ROE/ROA/NPM/EPS).
  app.get("/api/idx/ratios/:symbol", async (req, res) => {
    try {
      const { getIDXRatioForSymbol } = await import("../engine/idxData");
      const ratio = await getIDXRatioForSymbol(req.params.symbol);
      if (!ratio) return res.status(404).json({ error: "No ratio data", symbol: req.params.symbol });
      res.json(ratio);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Per-stock official announcements / disclosures.
  app.get("/api/idx/announcements/:symbol", async (req, res) => {
    try {
      const { fetchIDXAnnouncements } = await import("../engine/idxData");
      const items = await fetchIDXAnnouncements(req.params.symbol);
      res.json({ symbol: req.params.symbol.toUpperCase(), items });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // All IDX indices (IHSG, LQ45, sector indices…).
  app.get("/api/idx/indices", async (_req, res) => {
    try {
      const { fetchIDXIndexList } = await import("../engine/idxData");
      res.json({ indices: await fetchIDXIndexList() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Daily movers: top gainers, losers, most active (by IDR value).
  app.get("/api/idx/movers", async (req, res) => {
    try {
      const { getIDXMovers } = await import("../engine/idxData");
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
      res.json(await getIDXMovers(limit));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Recent dividend announcements (last ~3 months).
  app.get("/api/idx/dividends", async (_req, res) => {
    try {
      const { fetchIDXDividends } = await import("../engine/idxData");
      res.json({ dividends: await fetchIDXDividends() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

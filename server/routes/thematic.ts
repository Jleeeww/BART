import type { Express } from "express";
import { storage } from "../storage";

/**
 * Thematic Event Scanner (Layer 8) — read endpoints.
 * OVERLAY ONLY: these serve labeled "Interpretasi AI" data. They never affect
 * the deterministic score. Manual scan triggering lives at /api/admin/scan/trigger.
 */
export function registerThematicRoutes(app: Express): void {
  // Latest scan + its flags (for the "Tema Pasar" market-wide view).
  app.get('/api/thematic/latest', async (_req, res) => {
    try {
      const scan = await storage.getLatestThematicScan();
      if (!scan) {
        return res.status(200).json({ scan: null, flags: [], message: 'Belum ada pemindaian tema.' });
      }
      const { db } = await import('../db');
      const { thematicStockFlags } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const flags = await db.select().from(thematicStockFlags).where(eq(thematicStockFlags.scanId, scan.id));
      res.status(200).json({ scan, flags });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Flags for a single symbol from the latest scan (stock-detail overlay).
  app.get('/api/thematic/symbol/:symbol', async (req, res) => {
    try {
      const symbol = String(req.params.symbol || '').toUpperCase();
      const flags = await storage.getThematicFlagsForSymbol(symbol);
      const scan = await storage.getLatestThematicScan();
      res.status(200).json({
        symbol,
        flags,
        scanAt: scan?.scanAt ?? null,
        updatedAt: scan?.scanAt ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Recent scan history.
  app.get('/api/thematic/history', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
      const scans = await storage.getRecentThematicScans(limit);
      res.status(200).json({ scans, count: scans.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

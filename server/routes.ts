import type { Express } from "express";
import type { Server } from "http";
import { testBandarmologyRouter } from "./routes/testBandarmology";
import { registerAdminRoutes } from "./routes/admin";
import { registerAuthRoutes } from "./routes/auth";
import { registerScraperRoutes } from "./routes/scraper";
import { registerBacktestRoutes } from "./routes/backtest";
import { registerDistributionRoutes } from "./routes/distribution";
import { registerValuationRoutes } from "./routes/valuation";
import { registerSignalsRoutes } from "./routes/signals";
import { registerMacroRoutes } from "./routes/macro";
import { registerInsiderRoutes } from "./routes/insider";
import { registerManagementRoutes } from "./routes/management";
import { registerNewsRoutes } from "./routes/news";
import { registerWatchlistRoutes } from "./routes/watchlist";
import { registerRadarRoutes } from "./routes/radar";
import { registerSimulationRoutes } from "./routes/simulation";
import { registerPipelineRoutes } from "./routes/pipeline";
import { registerStocksRoutes } from "./routes/stocks";
import { registerAiRoutes } from "./routes/ai";
import { registerChatRoutes } from "./routes/chat";
import { registerIdxDataRoutes } from "./routes/idxData";
import { registerThematicRoutes } from "./routes/thematic";

// ========================================
// UNIFIED BRAIN ENGINE
// Single source of truth: getStockDecision() in server/engine/unifiedDecision.ts
// 3 Actions: BUY, WATCHLIST, AVOID
// 3 Buckets: Siap Dipantau, Watchlist Prioritas, Hindari Dulu
// ========================================

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", testBandarmologyRouter);

  registerAuthRoutes(app);

  // ── Stocks routes ──────────────────────────────────────────────────────────────
  registerStocksRoutes(app);

  // Watchlist endpoints
  // ── Watchlist routes ─────────────────────────────────────────────────────────
  registerWatchlistRoutes(app);


  // ── AI routes ─────────────────────────────────────────────────────────────────
  registerAiRoutes(app);

  // ── Chat with BART routes ─────────────────────────────────────────────────────
  registerChatRoutes(app);
  // ── Simulation routes ────────────────────────────────────────────────────────
  registerSimulationRoutes(app);

  // ── Radar routes ─────────────────────────────────────────────────────────────
  registerRadarRoutes(app);

  // ── Valuation routes ─────────────────────────────────────────────────────────
  registerValuationRoutes(app);

  // ── Macro/alt-data routes ────────────────────────────────────────────────────
  registerMacroRoutes(app);

  // ── Pipeline routes (history, ingest, monitor) ───────────────────────────────
  registerPipelineRoutes(app);

  // ── Signals routes ───────────────────────────────────────────────────────────
  registerSignalsRoutes(app);

  // ── Backtest routes ──────────────────────────────────────────────────────────
  registerBacktestRoutes(app);

  // ── Distribution routes ──────────────────────────────────────────────────────
  registerDistributionRoutes(app);

  // ── News routes ──────────────────────────────────────────────────────────────
  registerNewsRoutes(app);

  // ── Scraper routes ───────────────────────────────────────────────────────────
  registerScraperRoutes(app);


  // ── Insider + Management routes ──────────────────────────────────────────────
  registerInsiderRoutes(app);
  registerManagementRoutes(app);

  // ── IDX official market-data routes ──────────────────────────────────────────
  registerIdxDataRoutes(app);

  // ── Thematic scanner routes (Layer 8 — overlay only) ─────────────────────────
  registerThematicRoutes(app);

  // ── Admin routes ─────────────────────────────────────────────────────────────
  registerAdminRoutes(app);

  return httpServer;
}

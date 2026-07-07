import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// Schedules fn() daily at the given local clock time (hour:minute in tzOffsetHours UTC offset)
function scheduleDaily(
  hour: number, minute: number, tzOffsetHours: number,
  fn: () => Promise<void>, label: string
): void {
  function msUntilNext(): number {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(hour - tzOffsetHours, minute, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }
  function tick(): void {
    setTimeout(async () => {
      try { await fn(); } catch (err) { console.warn(`[${label}] error:`, err); }
      tick();
    }, msUntilNext());
  }
  tick();
  log(`${label} scheduled daily at ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} WIB`, label);
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "127.0.0.1",
    },
    () => {
      log(`serving on port ${port}`);

      import('./engine/altDataFetcher')
        .then(({ warmAltDataCaches }) => warmAltDataCaches())
        .catch(err => console.warn('[startup] altDataFetcher warmup error:', err));

      // Cost projection — log immediately at startup (no API calls needed)
      import('./engine/costTracker')
        .then(({ logStartupCostEstimate }) => logStartupCostEstimate())
        .catch(() => {});

      // News pipeline — first run after 30s (let server warm up), then every 15min
      setTimeout(() => {
        import('./engine/newsFetcher')
          .then(({ runNewsCycle }) => {
            runNewsCycle().catch(() => {});
            setInterval(() => runNewsCycle().catch(() => {}), 15 * 60 * 1000);
            log('News pipeline scheduled (15min interval)', 'newsPipeline');
          })
          .catch(err => console.warn('[startup] news pipeline schedule error:', err));
      }, 30000);

      // RAG schema init (non-blocking)
      import('./engine/ragEngine')
        .then(({ ensureRagSchema }) => ensureRagSchema())
        .catch(err => console.warn('[startup] RAG schema init error:', err));

      // OHLCV price ingestion — Yahoo (.JK) → session_history, dataSource='YAHOO'.
      // Hourly during IDX market hours (so today's forming candle updates), plus
      // one run ~20s after boot so prices are fresh immediately in dev.
      const runOHLCVIngest = async () => {
        const { ingestOHLCVBatch } = await import('./engine/ohlcvIngester');
        const { HOMEPAGE_UNIVERSE } = await import('./engine/lq45Universe');
        const { invalidateRadarCache } = await import('./engine/radarEngine');
        const r = await ingestOHLCVBatch(HOMEPAGE_UNIVERSE, 40);
        invalidateRadarCache();
        log(`[ohlcvIngest] ok=${r.ok}/${r.total} bars=${r.totalBars} failed=${r.failed.length}`, 'ohlcvIngest');
      };
      const isIDXHoursWIB = (): boolean => {
        const wib = new Date(Date.now() + 7 * 3600 * 1000); // shift to WIB, read as UTC
        const day = wib.getUTCDay();   // 0=Sun … 6=Sat
        const hour = wib.getUTCHours();
        return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
      };
      setTimeout(() => {
        runOHLCVIngest().catch((err) => log(`[ohlcvIngest] startup error: ${err}`, 'ohlcvIngest'));
      }, 20000);
      setInterval(() => {
        if (isIDXHoursWIB()) {
          runOHLCVIngest().catch((err) => log(`[ohlcvIngest] error: ${err}`, 'ohlcvIngest'));
        }
      }, 60 * 60 * 1000);
      log('OHLCV ingestion scheduled (hourly during IDX market hours + startup)', 'ohlcvIngest');

      // IDX fundamentals refresh — price + PER/ROE into stocks table, daily
      // 17:15 WIB (post-close) + one run 40s after boot.
      const runFundamentals = async () => {
        const { updateStocksFromIDX } = await import('./engine/idxFundamentalsIngester');
        const r = await updateStocksFromIDX();
        log(`[idxFundamentals] updated=${r.updated} price=${r.priceUpdated} ratio=${r.ratioUpdated}`, 'idxFundamentals');
      };
      setTimeout(() => {
        runFundamentals().catch((err) => log(`[idxFundamentals] startup error: ${err}`, 'idxFundamentals'));
      }, 40000);
      scheduleDaily(17, 15, 7, runFundamentals, 'idxFundamentals');

      // Macro flow fetch — 06:00 WIB (23:00 UTC prev day, post-US close) and 16:30 WIB (09:30 UTC, post-IDX close)
      const runMacroFlow = async () => {
        const { getMacroFlowSnapshot, persistMacroFlowSnapshot } = await import('./engine/macroFlowFetcher');
        const { computeMacroRegime } = await import('./engine/macroRegimeDetector');
        const snapshot = await getMacroFlowSnapshot();
        await persistMacroFlowSnapshot(snapshot);
        const regime = await computeMacroRegime();
        // Persist regime to macro_regime_history
        try {
          const { pool } = await import('./db');
          await pool.query(
            `INSERT INTO macro_regime_history (date, regime, multiplier, confidence, triggers, duration_days)
             VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)
             ON CONFLICT (date) DO UPDATE SET
               regime = EXCLUDED.regime, multiplier = EXCLUDED.multiplier,
               confidence = EXCLUDED.confidence, triggers = EXCLUDED.triggers,
               duration_days = EXCLUDED.duration_days, computed_at = NOW()`,
            [regime.regime, regime.multiplier, regime.confidence, JSON.stringify(regime.triggers), regime.durationDays]
          );
        } catch (err) {
          log(`[macroFlow] regime persist error: ${err}`, 'macroFlow');
        }
        log(`[macroFlow] snapshot=${snapshot.dataQuality} regime=${regime.regime} mult=${regime.multiplier}`, 'macroFlow');
      };
      scheduleDaily(6, 0, 7, runMacroFlow, 'macroFlow_earlyAM');
      scheduleDaily(16, 30, 7, runMacroFlow, 'macroFlow_postMarket');

      // Outcome tracker — daily at 17:00 WIB (10:00 UTC)
      scheduleDaily(17, 0, 7, async () => {
        const { runDailyOutcomeTracking } = await import('./engine/outcomeTracker');
        await runDailyOutcomeTracking();
      }, 'outcomeTracker');

      // Insider research — daily post-market check 17:30 WIB (10:30 UTC)
      // Light scan: only researches symbols already in the insider cache (refresh)
      // Full research (new symbols) is triggered via POST /api/insider/:symbol/research
      scheduleDaily(17, 30, 7, async () => {
        const { getInsiderCacheStats, getCachedInsiderScore, cacheInsiderScore, scoreInsider } = await import('./engine/insiderScorer');
        const { researchInsiderTransactions } = await import('./engine/insiderResearch');
        if (!process.env.ANTHROPIC_API_KEY) return;
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const { symbols } = getInsiderCacheStats();
        const staleSymbols = symbols.filter((sym) => {
          const s = getCachedInsiderScore(sym);
          if (!s) return true;
          const ageDays = (Date.now() - new Date(s.computedAt).getTime()) / 86_400_000;
          return ageDays > 7; // refresh weekly (cache TTL = 7 days)
        });

        log(`[insiderRefresh] Refreshing ${staleSymbols.length} symbols`, 'insiderRefresh');
        const MAX_STOCKS_PER_RUN = 10;
        for (const sym of staleSymbols.slice(0, MAX_STOCKS_PER_RUN)) {
          try {
            const transactions = await researchInsiderTransactions(sym, sym, client, 6);
            const result = await scoreInsider(transactions, sym);
            cacheInsiderScore(sym, result);
            log(`[insiderRefresh] ${sym}: ${result.signal} (score=${result.score ?? 'null'})`, 'insiderRefresh');
          } catch (err) {
            log(`[insiderRefresh] ${sym}: error — ${err}`, 'insiderRefresh');
          }
        }
      }, 'insiderRefresh');

      // DEMO MODE: Broker scrape schedulers disabled — IDX/Stockbit blocked by Cloudflare.
      // Use POST /api/admin/seed-broker-data or `npm run seed:demo` to inject broker data manually.
      // Re-enable these three scheduleDaily calls when live scraping is unblocked.
      //
      // scheduleDaily(16, 45, 7, runBrokerScrape, 'brokerScrape_postClose');
      // scheduleDaily(18, 30, 7, runBrokerScrape, 'brokerScrape_evening');
      // scheduleDaily(20,  0, 7, runBrokerScrape, 'brokerScrape_night');
      log('Broker scrape schedulers DISABLED (demo mode — manual seed via /api/admin/seed-broker-data)', 'brokerScrape');
    },
  );
})();

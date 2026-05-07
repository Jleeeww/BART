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
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      import('./engine/altDataFetcher')
        .then(({ warmAltDataCaches }) => warmAltDataCaches())
        .catch(err => console.warn('[startup] altDataFetcher warmup error:', err));

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

      // Outcome tracker — daily at 17:00 WIB (10:00 UTC)
      scheduleDaily(17, 0, 7, async () => {
        const { runDailyOutcomeTracking } = await import('./engine/outcomeTracker');
        await runDailyOutcomeTracking();
      }, 'outcomeTracker');
    },
  );
})();

import type { Express } from "express";
import { getStockDecision, mapStockDataToInput } from "../engine/unifiedDecision";
import { computeCompositeV3 } from "../engine/compositeEngineV3";
import { computeM17 } from "../engine/bandarmologyExtensions";

export function registerAdminRoutes(app: Express): void {
  // Auth helper: if ADMIN_TOKEN/MANAGEMENT_TOKEN is set, require it; otherwise
  // allow (dev convenience). Set a token before any public exposure.
  const adminToken = () => process.env.ADMIN_TOKEN || process.env.MANAGEMENT_TOKEN || '';
  const isAuthed = (req: any): boolean => {
    const token = adminToken();
    if (!token) return true; // dev: no token configured → open
    return req.headers.authorization === `Bearer ${token}`;
  };
  const requireAdmin = (req: any, res: any): boolean => {
    if (isAuthed(req)) return true;
    res.status(401).json({ error: 'Unauthorized — admin token required' });
    return false;
  };

  // Public: tells the login screen whether a token is required and whether the
  // presented Bearer is valid. Reveals only booleans, never the token.
  app.get('/api/admin/auth-status', (req, res) => {
    res.status(200).json({ authRequired: !!adminToken(), authenticated: isAuthed(req) });
  });

  // ── Runtime config (crisis mode / suppression / scanner / cost caps) ──────────
  // GET effective config + live regime + today's spend for the admin dashboard.
  app.get('/api/admin/config', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { getAllConfig } = await import('../engine/systemConfig');
      const { getCachedMacroRegime } = await import('../engine/macroRegimeDetector');
      const { getDailyCost, DAILY_CAPS } = await import('../engine/costTracker');
      res.status(200).json({
        config: await getAllConfig(),
        effectiveRegime: getCachedMacroRegime(),
        cost: getDailyCost(),
        baseCaps: DAILY_CAPS,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST a single config key (allowlist-validated).
  app.post('/api/admin/config', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { key, value } = req.body as { key?: string; value?: unknown };
      const { CONFIG_KEYS, setConfig } = await import('../engine/systemConfig');
      const allowed = Object.values(CONFIG_KEYS) as string[];
      if (!key || !allowed.includes(key)) {
        return res.status(400).json({ error: `invalid key — allowed: ${allowed.join(', ')}` });
      }
      if (value === undefined || value === null || typeof value !== 'object') {
        return res.status(400).json({ error: 'value must be a JSON object' });
      }
      await setConfig(key as any, value, 'admin-dashboard');
      res.status(200).json({ ok: true, key, value });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Manually trigger a thematic scan now.
  app.post('/api/admin/scan/trigger', async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const { runThematicScan } = await import('../engine/thematicScanner');
      const result = await runThematicScan('MANUAL');
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/admin/seed-broker-data
  // Manually seeds broker data for a stock (demo mode — no live scraping needed).
  // Auth: Bearer MANAGEMENT_TOKEN
  app.post('/api/admin/seed-broker-data', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token      = process.env.MANAGEMENT_TOKEN;
      if (!token || authHeader !== `Bearer ${token}`) {
        return res.status(401).json({ error: 'Unauthorized — MANAGEMENT_TOKEN required' });
      }

      const {
        symbol: rawSymbol,
        date: rawDate,
        brokers,
        netFlow,
        price,
      } = req.body as {
        symbol:   string;
        date:     string;
        brokers:  Array<{
          code: string; name?: string;
          netBuy?: string | null; netSell?: string | null;
          volumePercent?: string; avgBuy?: string; avgSell?: string;
        }>;
        netFlow?: number;
        price?:   number;
      };

      if (!rawSymbol || typeof rawSymbol !== 'string') {
        return res.status(400).json({ error: 'symbol required' });
      }
      const symbol = rawSymbol.toUpperCase().trim();
      if (!/^[A-Z0-9]{1,6}$/.test(symbol)) {
        return res.status(400).json({ error: 'invalid symbol format' });
      }

      if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        return res.status(400).json({ error: 'date required in YYYY-MM-DD format' });
      }
      const dateObj = new Date(rawDate + 'T00:00:00.000Z');
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: 'invalid date' });
      }

      if (!Array.isArray(brokers) || brokers.length < 3) {
        return res.status(400).json({ error: 'brokers array with at least 3 entries required' });
      }

      const { pool } = await import('../db');

      // Verify symbol exists in DB
      const stockRow = await pool.query(
        'SELECT symbol, "avg20d_value", "pe_ratio", "dividend_yield", roe, "net_margin", sector, "flow_bias", "flow_intensity", "flow_reliability", "stock_character", "change_percent", growth, "insider_data", "foreign_activity_data", "broker_data" FROM stocks WHERE symbol = $1',
        [symbol]
      );
      if (stockRow.rows.length === 0) {
        return res.status(404).json({ error: `Symbol ${symbol} not found in database` });
      }
      const stock = stockRow.rows[0];

      // Compute composite BEFORE seed (using current brokerData in DB)
      const brokersBeforeRaw = (() => {
        try { return JSON.parse(stock.broker_data || '[]'); } catch { return []; }
      })();
      const brainInputBefore = mapStockDataToInput({
        flowBias:           stock.flow_bias,
        flowIntensity:      stock.flow_intensity,
        flowReliability:    stock.flow_reliability,
        changePercent:      stock.change_percent,
        growth:             stock.growth,
        insiderData:        stock.insider_data,
        brokerData:         stock.broker_data,
        foreignActivityData:stock.foreign_activity_data,
        stockCharacter:     stock.stock_character,
        isGorengan:         false,
      });
      // Map stored broker format (netBuy/netSell) to BrokerRecord format (netBuyRaw/netSellRaw)
      const toBrokerRecord = (b: any) => ({
        code:         b.code,
        netBuyRaw:    b.netBuyRaw  ?? b.netBuy  ?? null,
        netSellRaw:   b.netSellRaw ?? b.netSell ?? null,
        volumePercent:b.volumePercent ?? null,
        avgBuyPrice:  b.avgBuyPrice ?? b.avgBuy  ?? null,
        avgSellPrice: b.avgSellPrice ?? b.avgSell ?? null,
      });

      const decisionBefore   = getStockDecision(brainInputBefore);
      const m17Before        = computeM17(brokersBeforeRaw.map(toBrokerRecord), stock.avg20d_value ?? null);
      const compositeBefore  = computeCompositeV3({
        symbol,
        sector:            stock.sector ?? null,
        bandarmologyScore: decisionBefore.readiness,
        isGorengan:        false,
        peRatio:           stock.pe_ratio    ? parseFloat(stock.pe_ratio)    : null,
        dividendYield:     stock.dividend_yield ? parseFloat(stock.dividend_yield) : null,
        roe:               stock.roe         ? parseFloat(stock.roe)         : null,
        netMargin:         stock.net_margin  ? parseFloat(stock.net_margin)  : null,
        extensionScores:   { m17Score: m17Before.score, m18GapPct: null, m24Score: null },
      });

      // Persist new broker data to stocks table
      const brokersJson = JSON.stringify(brokers);
      await pool.query(
        `UPDATE stocks
           SET broker_data = $1,
               scrape_source = 'MANUAL_SEED',
               last_broker_scrape = NOW(),
               scrape_quality = 'COMPLETE'
         WHERE symbol = $2`,
        [brokersJson, symbol]
      );

      // Insert session_history row (session=0 = regular session)
      await pool.query(
        `INSERT INTO session_history
           (symbol, date, session, broker_data, net_flow, close, data_source)
         VALUES ($1, $2, 0, $3::jsonb, $4, $5, 'MANUAL_SEED')
         ON CONFLICT (symbol, date, session) DO UPDATE SET
           broker_data = EXCLUDED.broker_data,
           net_flow    = EXCLUDED.net_flow,
           close       = EXCLUDED.close,
           data_source = 'MANUAL_SEED'`,
        [symbol, rawDate, brokersJson, netFlow ?? null, price ?? null]
      );

      // Compute composite AFTER seed
      const brainInputAfter = mapStockDataToInput({
        flowBias:           stock.flow_bias,
        flowIntensity:      stock.flow_intensity,
        flowReliability:    stock.flow_reliability,
        changePercent:      stock.change_percent,
        growth:             stock.growth,
        insiderData:        stock.insider_data,
        brokerData:         brokersJson,
        foreignActivityData:stock.foreign_activity_data,
        stockCharacter:     stock.stock_character,
        isGorengan:         false,
      });
      const decisionAfter  = getStockDecision(brainInputAfter);
      const m17After       = computeM17(brokers.map(toBrokerRecord), stock.avg20d_value ?? null);
      const compositeAfter = computeCompositeV3({
        symbol,
        sector:            stock.sector ?? null,
        bandarmologyScore: decisionAfter.readiness,
        isGorengan:        false,
        peRatio:           stock.pe_ratio    ? parseFloat(stock.pe_ratio)    : null,
        dividendYield:     stock.dividend_yield ? parseFloat(stock.dividend_yield) : null,
        roe:               stock.roe         ? parseFloat(stock.roe)         : null,
        netMargin:         stock.net_margin  ? parseFloat(stock.net_margin)  : null,
        extensionScores:   { m17Score: m17After.score, m18GapPct: null, m24Score: null },
      });

      res.json({
        symbol,
        date: rawDate,
        composite: {
          before:      compositeBefore.compositeScore,
          after:       compositeAfter.compositeScore,
          delta:       compositeAfter.compositeScore - compositeBefore.compositeScore,
          bucketBefore: compositeBefore.homepageBucket,
          bucketAfter:  compositeAfter.homepageBucket,
        },
        extensionScores: {
          M17before: m17Before.score,
          M17after:  m17After.score,
          M18:       null,
          M24:       null,
        },
        activeFlags: compositeAfter.activeFlags,
        brokersSeeded: brokers.length,
        message: `Seeded ${brokers.length} brokers for ${symbol} on ${rawDate}. Composite ${compositeBefore.compositeScore} → ${compositeAfter.compositeScore} (${compositeAfter.compositeScore >= compositeBefore.compositeScore ? '+' : ''}${compositeAfter.compositeScore - compositeBefore.compositeScore}).`,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

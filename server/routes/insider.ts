import type { Express } from "express";
import Anthropic from "@anthropic-ai/sdk";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function registerInsiderRoutes(app: Express): void {
  app.get('/api/insider/cluster-alerts', async (_req, res) => {
    try {
      const { getInsiderCacheStats, getCachedInsiderScore } = await import('../engine/insiderScorer');
      const { symbols } = getInsiderCacheStats();
      const alerts = symbols
        .map((sym) => {
          const s = getCachedInsiderScore(sym);
          if (!s || !s.clusterBuySignal || s.score === null) return null;
          return {
            symbol:            sym,
            score:             s.score,
            signal:            s.signal,
            insiderBuyCount:   s.insiderBuyCount,
            priceContextSignal:s.priceContextSignal,
            note:              s.note,
            computedAt:        s.computedAt,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());

      res.json({ alerts, total: alerts.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/insider/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();
      const { getCachedInsiderScore } = await import('../engine/insiderScorer');
      const { getCachedInsiderTransactions } = await import('../engine/insiderResearch');
      const result = getCachedInsiderScore(symbol);
      if (!result) {
        return res.status(404).json({
          error:  'No insider research found for this symbol',
          symbol,
          hint:   'Trigger research via POST /api/insider/:symbol/research',
        });
      }
      const transactions = getCachedInsiderTransactions(symbol) ?? result.topTransactions;
      res.json({ ...result, allTransactions: transactions });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/insider/:symbol/research', async (req, res) => {
    try {
      if (!anthropicClient) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
      }

      const authHeader = req.headers.authorization;
      const token      = process.env.MANAGEMENT_TOKEN;
      if (!token || authHeader !== `Bearer ${token}`) {
        return res.status(401).json({ error: 'Unauthorized — MANAGEMENT_TOKEN required' });
      }

      const symbol      = req.params.symbol.toUpperCase();
      const { companyName = symbol, monthsBack = 6 } = req.body as {
        companyName?: string;
        monthsBack?:  number;
      };

      const { researchInsiderTransactions } = await import('../engine/insiderResearch');
      const { scoreInsider, cacheInsiderScore } = await import('../engine/insiderScorer');

      const transactions = await researchInsiderTransactions(symbol, companyName, anthropicClient, monthsBack);
      const scoreResult  = await scoreInsider(transactions, symbol);
      cacheInsiderScore(symbol, scoreResult);

      res.json({
        symbol,
        transactionsFound: transactions.length,
        score:             scoreResult.score,
        signal:            scoreResult.signal,
        clusterBuySignal:  scoreResult.clusterBuySignal,
        priceContextSignal:scoreResult.priceContextSignal,
        filingDelayFlag:   scoreResult.filingDelayFlag,
        note:              scoreResult.note,
        topTransactions:   scoreResult.topTransactions,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

import type { Express } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { stocks as stocksTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function registerNewsRoutes(app: Express): void {
  app.get('/api/news/status', async (_req, res) => {
    try {
      const { getNewsFetcherStatus, fetchLatestNews } =
        await import('../engine/newsFetcher');
      await fetchLatestNews();
      const status = getNewsFetcherStatus();
      res.status(200).json(status);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Raw news feed with images (no AI). Optional ?symbol=&company= HARD-FILTERS
  // to articles genuinely about that stock (falls back to the unfiltered feed
  // only if the filter finds nothing, so a tab never renders empty). When a
  // symbol is given, official IDX per-stock announcements are merged in too —
  // the one source that's genuinely per-ticker rather than keyword-matched.
  // Powers the default Berita tab content.
  app.get('/api/news/feed', async (req, res) => {
    try {
      const { fetchLatestNews, screenArticle } = await import('../engine/newsFetcher');
      const all = await fetchLatestNews();
      let articles = all.filter(screenArticle);
      if (articles.length === 0) articles = all;

      const symbol = String(req.query.symbol || '').toUpperCase();
      const company = String(req.query.company || '').toLowerCase();
      // Generic corporate words ("Bank", "PT", "Tbk", ...) are too common in
      // Indonesian finance headlines to use as a relevance signal on their own
      // (e.g. "Bank" from "Bank Central Asia" would match nearly every article
      // about Bank Indonesia) — pick the first genuinely distinctive word.
      const COMPANY_STOPWORDS = new Set([
        'bank', 'perusahaan', 'group', 'grup', 'indonesia', 'nusantara',
        'sejahtera', 'sentosa', 'utama', 'jaya', 'mandiri', 'persero',
      ]);
      const distinctiveWord = company
        .split(/\s+/)
        .filter((w) => w.length > 3 && !COMPANY_STOPWORDS.has(w))[0] ?? '';

      let result = articles;
      if (symbol || distinctiveWord) {
        const isRel = (a: any) => {
          const t = `${a.title} ${a.summary}`.toLowerCase();
          return (symbol.length >= 3 && t.includes(symbol.toLowerCase())) ||
                 (distinctiveWord && t.includes(distinctiveWord));
        };
        const filtered = articles.filter(isRel);
        result = filtered.length > 0 ? filtered : articles;
      }

      if (symbol) {
        try {
          const { fetchIDXAnnouncements } = await import('../engine/idxData');
          const announcements = await fetchIDXAnnouncements(symbol);
          const idxArticles = announcements.map((a, i) => ({
            id: `idx-ann-${symbol}-${i}-${a.date ?? ''}`,
            title: a.title,
            summary: `Pengumuman resmi IDX untuk ${symbol}.`,
            content: `Pengumuman resmi IDX untuk ${symbol}.`,
            source: 'IDX Resmi',
            url: a.attachments[0]?.url ?? '',
            publishedAt: a.date ?? new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            imageUrl: '',
          }));
          result = [...idxArticles, ...result].sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        } catch {
          // IDX announcements are a bonus merge — never let a failure break the feed.
        }
      }

      res.json({ articles: result.slice(0, 30) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/news', async (_req, res) => {
    try {
      const { fetchLatestNews, screenArticle } = await import('../engine/newsFetcher');
      const { getNewsRouterStats } = await import('../engine/newsRouter');
      const { getAnalyzedCache } = await import('../engine/newsAnalyzer');
      const allArticles = await fetchLatestNews();
      const relevant = allArticles.filter(screenArticle);
      const analyzed = getAnalyzedCache();
      const stats = getNewsRouterStats();

      const feed = relevant.slice(0, 50).map((a) => {
        const cached = analyzed.get(a.id);
        if (!cached) {
          return {
            id: a.id, title: a.title,
            summary: a.summary?.slice(0, 300) ?? '',
            source: a.source, url: a.url, publishedAt: a.publishedAt,
            analyzed: false,
          };
        }
        const analysis = cached.analysis;
        const dirs = analysis.affectedEntities.map((e) => e.direction).filter((d) => d !== 'MIXED');
        const neg = dirs.filter((d) => d === 'NEGATIF').length;
        const pos = dirs.filter((d) => d === 'POSITIF').length;
        const overallDirection = neg > pos ? 'NEGATIF' : pos > neg ? 'POSITIF' : 'NETRAL';

        const affectedSymbols = analysis.affectedEntities
          .filter((e) => e.type === 'STOCK' && e.symbol)
          .map((e) => ({ symbol: e.symbol!, direction: e.direction, strength: e.strength }));
        const affectedSectors = analysis.affectedEntities
          .filter((e) => e.type === 'SECTOR')
          .map((e) => ({ name: e.name, direction: e.direction }));

        return {
          id: a.id, title: a.title,
          summary: a.summary?.slice(0, 300) ?? '',
          source: a.source, url: a.url, publishedAt: a.publishedAt,
          analyzed: true,
          severity: analysis.eventSeverity,
          direction: overallDirection,
          eventType: analysis.eventType,
          traderImplication: analysis.traderImplication,
          rawInsight: analysis.rawInsight,
          mechanism: analysis.traderImplication ?? analysis.rawInsight,
          affectedSymbols,
          affectedSectors,
        };
      });

      res.status(200).json({ feed, stats, total: relevant.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // IMPORTANT: /api/news/market/alerts MUST be registered before /api/news/:symbol
  // to prevent Express matching "market" as a symbol param.
  app.get('/api/news/market/alerts', async (_req, res) => {
    try {
      const { getMarketAlerts, getNewsRouterStats } = await import('../engine/newsRouter');
      const alerts = getMarketAlerts();
      const stats  = getNewsRouterStats();
      res.status(200).json({ alerts, stats });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/news/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol.toUpperCase();

      const stockRows = await db
        .select({ sector: stocksTable.sector })
        .from(stocksTable)
        .where(eq(stocksTable.symbol, symbol));
      const sector = stockRows[0]?.sector ?? '';

      const { fetchLatestNews, screenArticle } = await import('../engine/newsFetcher');
      const allArticles = await fetchLatestNews();
      const relevant = allArticles.filter(screenArticle);

      const { getImpactsForSymbol } = await import('../engine/newsRouter');
      const impacts = getImpactsForSymbol(symbol, sector);

      res.status(200).json({
        symbol,
        sector,
        impacts,
        articleCount: relevant.length,
        cachedArticles: relevant.slice(0, 10).map((a) => ({
          id:          a.id,
          title:       a.title,
          summary:     a.summary.slice(0, 250),
          source:      a.source,
          url:         a.url,
          publishedAt: a.publishedAt,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/news/analyze/:articleId', async (req, res) => {
    try {
      if (!anthropicClient) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
      }

      const { articleId } = req.params;
      const { getNewsCache, screenArticle } = await import('../engine/newsFetcher');
      const { analyzeNewsImpact }           = await import('../engine/newsAnalyzer');

      const article = getNewsCache().find((a) => a.id === articleId);
      if (!article) {
        return res.status(404).json({ error: 'Article not found in cache', articleId });
      }

      if (!screenArticle(article)) {
        return res.status(400).json({ error: 'Article did not pass relevance screen', articleId });
      }

      const analysis = await analyzeNewsImpact(article, anthropicClient);
      if (!analysis) {
        return res.status(422).json({ error: 'Analysis failed — Claude returned no valid JSON', articleId });
      }

      res.status(200).json(analysis);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

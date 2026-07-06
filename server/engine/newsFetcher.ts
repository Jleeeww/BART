/**
 * ============================================================
 * NEWS FETCHER v1.0
 * ============================================================
 * server/engine/newsFetcher.ts
 *
 * Fetches and caches news from Indonesian financial RSS feeds.
 * Never throws — returns stale cache or empty array on any failure.
 *
 * CACHE TTL: 15min market hours, 60min off-hours (same as altDataFetcher)
 * PARSER: regex-based RSS 2.0 + Atom, handles CDATA & HTML tags inline
 * ISOLATION: each source is fetched independently via Promise.allSettled
 * SCREENING: keyword pre-filter — zero AI cost
 *
 * SOURCES (all free, no API key required):
 *   kontan.co.id, cnbcindonesia.com, detik.com/finance,
 *   bisnis.com, tempo.co/bisnis
 * ============================================================
 */

import crypto from 'node:crypto';

// ── Types ────────────────────────────────────────────────────

export interface RawNewsArticle {
  id: string;           // md5(title + source + publishedAt).slice(0,16)
  title: string;
  summary: string;
  content: string;      // same as summary for RSS (full text rarely available)
  url: string;
  source: string;
  publishedAt: string;  // ISO 8601
  fetchedAt: string;    // ISO 8601
}

// ── Source registry ──────────────────────────────────────────

const NEWS_SOURCES: Array<{ name: string; url: string }> = [
  { name: 'Kontan',           url: 'https://rss.kontan.co.id/kontan/' },
  { name: 'CNBC Indonesia',   url: 'https://www.cnbcindonesia.com/rss' },
  { name: 'Detik Finance',    url: 'https://finance.detik.com/rss' },
  { name: 'Bisnis Indonesia', url: 'https://rss.bisnis.com/' },
  { name: 'Tempo Bisnis',     url: 'https://rss.tempo.co/bisnis' },
];

// ── Relevance keywords ───────────────────────────────────────
// Case-insensitive match against title + summary. No AI cost.

const RELEVANCE_KEYWORDS = [
  'saham', 'idx', 'bei', 'ihsg', 'emiten', 'bursa',
  'ojk', 'bank indonesia', 'bi rate', 'rupiah', 'idr',
  'fitch', "moody's", 's&p', 'rating', 'downgrade', 'upgrade',
  'msci', 'ftse', 'rebalancing', 'foreign ownership',
  'batubara', 'coal', 'cpo', 'sawit', 'nikel', 'minyak',
  'dividen', 'rights issue', 'merger', 'akuisisi',
  'laba', 'rugi', 'pendapatan', 'revenue', 'earnings',
  'gagal bayar', 'default', 'pailit', 'delisting', 'sanksi',
  'inflasi', 'suku bunga', 'ekspor', 'impor', 'gdp',
];

// ── Config ───────────────────────────────────────────────────

const FETCH_TIMEOUT_MS       = 8000;
const MAX_ARTICLES_PER_SOURCE = 20;
const CACHE_TTL_MARKET        = 15 * 60 * 1000;
const CACHE_TTL_OFF           = 60 * 60 * 1000;

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BART-NewsFetcher/1.0; +https://bart.id)',
  'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
};

// ── Cache ────────────────────────────────────────────────────

let _cache: RawNewsArticle[] = [];
let _cacheTime = 0;

// ── Helpers ──────────────────────────────────────────────────

function isMarketHours(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay();
  if (day === 0 || day === 6) return false;
  const t = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  return (t >= 540 && t < 720) || (t >= 810 && t < 950);
}

function getCacheTTL(): number {
  return isMarketHours() ? CACHE_TTL_MARKET : CACHE_TTL_OFF;
}

function stripCDATA(text: string): string {
  // Unwrap CDATA sections, then strip any remaining HTML/XML tags
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractField(xml: string, ...tags: string[]): string {
  for (const tag of tags) {
    // Match <tag ...>content</tag>
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = re.exec(xml);
    if (m) return stripCDATA(m[1]);
  }
  return '';
}

function extractAtomLink(xml: string): string {
  // Atom uses <link href="..." rel="alternate"/> self-closing style
  const re = /<link[^>]+href="([^"]+)"[^>]*\/?>/i;
  const m = re.exec(xml);
  return m ? m[1] : '';
}

function parseISO(pubDate: string): string {
  if (!pubDate) return new Date().toISOString();
  try {
    const d = new Date(pubDate);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {
    // fall through
  }
  return new Date().toISOString();
}

function makeId(title: string, source: string, publishedAt: string): string {
  return crypto
    .createHash('md5')
    .update(`${title}|${source}|${publishedAt}`)
    .digest('hex')
    .slice(0, 16);
}

// ── RSS / Atom parser ────────────────────────────────────────

function parseRSSItems(xml: string, sourceName: string): RawNewsArticle[] {
  const fetchedAt = new Date().toISOString();
  const articles: RawNewsArticle[] = [];

  // Support both RSS <item> and Atom <entry>
  const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    if (articles.length >= MAX_ARTICLES_PER_SOURCE) break;

    const block = match[1];

    const title = extractField(block, 'title');
    if (!title || title.length < 5) continue;

    const summary = extractField(block, 'description', 'summary', 'content:encoded', 'content');
    const rawLink = extractField(block, 'link') || extractAtomLink(block) || extractField(block, 'guid');
    const url     = rawLink.startsWith('http') ? rawLink : '';
    const pubDate = extractField(block, 'pubDate', 'published', 'updated', 'dc:date');
    const publishedAt = parseISO(pubDate);

    const id = makeId(title, sourceName, publishedAt);
    const truncSummary = summary.slice(0, 1000);

    articles.push({
      id,
      title:       title.slice(0, 300),
      summary:     truncSummary,
      content:     truncSummary,
      url,
      source:      sourceName,
      publishedAt,
      fetchedAt,
    });
  }

  return articles;
}

// ── Per-source fetch ─────────────────────────────────────────

async function fetchFromSource(
  source: { name: string; url: string }
): Promise<RawNewsArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      signal:  controller.signal,
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[newsFetcher] ${source.name}: HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();
    const trimmed = text.trimStart();

    // Guard: reject HTML error pages — we expect XML
    if (
      !trimmed.startsWith('<') ||
      (trimmed.startsWith('<!DOCTYPE') && !trimmed.includes('<rss') && !trimmed.includes('<feed'))
    ) {
      console.warn(`[newsFetcher] ${source.name}: non-XML response (${trimmed.slice(0, 60)})`);
      return [];
    }

    const articles = parseRSSItems(text, source.name);
    console.log(`[newsFetcher] ${source.name}: ${articles.length} articles`);
    return articles;

  } catch (err: any) {
    clearTimeout(timer);
    const reason = err?.name === 'AbortError'
      ? `timeout after ${FETCH_TIMEOUT_MS}ms`
      : (err?.message ?? 'unknown error');
    console.warn(`[newsFetcher] ${source.name}: ${reason}`);
    return [];
  }
}

// ── Public API ───────────────────────────────────────────────

export async function fetchLatestNews(): Promise<RawNewsArticle[]> {
  if (_cache.length > 0 && Date.now() - _cacheTime < getCacheTTL()) {
    return _cache;
  }

  const settled = await Promise.allSettled(
    NEWS_SOURCES.map((s) => fetchFromSource(s))
  );

  const allArticles: RawNewsArticle[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') allArticles.push(...r.value);
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped: RawNewsArticle[] = [];
  for (const a of allArticles) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      deduped.push(a);
    }
  }

  // Newest first
  deduped.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  if (deduped.length > 0) {
    _cache = deduped;
    _cacheTime = Date.now();
  }

  return deduped;
}

export function screenArticle(article: RawNewsArticle): boolean {
  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => haystack.includes(kw));
}

export function getNewsCache(): RawNewsArticle[] {
  return _cache;
}

export function invalidateNewsCache(): void {
  _cache = [];
  _cacheTime = 0;
  console.log('[newsFetcher] Cache invalidated');
}

/**
 * Full news pipeline cycle: fetch → screen → analyze.
 * Designed to be called on a schedule (every 15 minutes).
 * Never throws — all errors caught internally.
 */
export async function runNewsCycle(): Promise<void> {
  try {
    const articles = await fetchLatestNews();
    const relevant = articles.filter(screenArticle);

    if (relevant.length === 0) {
      console.log('[newsPipeline] Cycle: no relevant articles');
      return;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(`[newsPipeline] Cycle: ${relevant.length} articles screened, skipping analysis (no ANTHROPIC_API_KEY)`);
      return;
    }

    const { isAnalysisHours, processArticleQueue } = await import('./newsAnalyzer');

    if (!isAnalysisHours()) {
      console.log('[newsPipeline] Outside analysis window (Mon-Fri 06:00-17:00 WIB), skipping Claude analysis');
      return;
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const results = await processArticleQueue(relevant, client);

    console.log(`[newsPipeline] Cycle complete: ${results.length}/${relevant.length} articles analyzed`);
  } catch (err: any) {
    console.error(`[newsPipeline] Cycle error: ${err?.message ?? err}`);
  }
}

export interface NewsFetcherStatus {
  cacheSize:      number;
  screenedCount:  number;
  cacheAgeMs:     number | null;
  isCacheValid:   boolean;
  isMarketHours:  boolean;
  cacheTTLMs:     number;
  sources:        string[];
}

export function getNewsFetcherStatus(): NewsFetcherStatus {
  const screened = _cache.filter(screenArticle).length;
  return {
    cacheSize:     _cache.length,
    screenedCount: screened,
    cacheAgeMs:    _cacheTime > 0 ? Date.now() - _cacheTime : null,
    isCacheValid:  _cache.length > 0 && Date.now() - _cacheTime < getCacheTTL(),
    isMarketHours: isMarketHours(),
    cacheTTLMs:    getCacheTTL(),
    sources:       NEWS_SOURCES.map((s) => s.name),
  };
}

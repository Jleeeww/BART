/**
 * ============================================================
 * NEWS ANALYZER v1.0
 * ============================================================
 * server/engine/newsAnalyzer.ts
 *
 * Analyzes news articles using Claude AI + web search.
 * Determines which IDX stocks/sectors are affected and how.
 * Includes macro override logic for critical systemic events.
 *
 * COST CONTROLS:
 *   - Max 10 articles per processArticleQueue() call
 *   - Max 2 web searches per article
 *   - 24h in-memory dedup cache by articleId
 *   - 30s per-article timeout
 *   - CRITICAL events processed first
 *
 * RELIABILITY:
 *   - Returns null on any failure — never throws
 *   - JSON parsing uses a lenient extractor with regex fallback
 *   - anthropicClient must exist (checked before any call)
 * ============================================================
 */

import Anthropic from '@anthropic-ai/sdk';
import type { RawNewsArticle } from './newsFetcher';
import { getMatchingCausalEvents, buildMacroContext } from './macroCausalKnowledge';
import { isCapReached, recordCost } from './costTracker';

// ── Types ────────────────────────────────────────────────────

export type EventType =
  | 'SOVEREIGN_CREDIT_EVENT'
  | 'MONETARY_POLICY'
  | 'REGULATORY_CHANGE'
  | 'COMMODITY_PRICE_MOVE'
  | 'CORPORATE_ACTION'
  | 'POLITICAL_EVENT'
  | 'GLOBAL_MACRO'
  | 'SECTOR_SPECIFIC'
  | 'CURRENCY_EVENT'
  | 'UNKNOWN';

export type MacroOverrideLevel = 'YES_HARD' | 'YES_SOFT' | 'NO';
// YES_HARD: caps composite score at 40 for affected stocks
// YES_SOFT: reduces confidence, adds warning label
// NO:       company-level signals remain valid

export type ExpiryHorizon = '1_DAY' | '1_WEEK' | '1_MONTH' | 'PERMANENT';

export interface AffectedEntity {
  type: 'SECTOR' | 'STOCK' | 'BROAD_MARKET';
  name: string;            // sector display name or stock name
  symbol: string | null;   // IDX ticker or null for sectors/market
  direction: 'POSITIF' | 'NEGATIF' | 'NETRAL' | 'MIXED';
  strength: 'KUAT' | 'SEDANG' | 'LEMAH';
  timeHorizon: 'IMMEDIATE' | 'SHORT' | 'MEDIUM';
  mechanism: string;       // causal explanation in Bahasa Indonesia
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface NewsImpactAnalysis {
  articleId: string;
  eventType: EventType;
  eventSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedEntities: AffectedEntity[];
  macroOverride: MacroOverrideLevel;
  macroOverrideReason: string | null;
  traderImplication: string;          // 2-3 sentences Bahasa Indonesia
  requiresImmediateAttention: boolean;
  expiryHorizon: ExpiryHorizon;
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rawInsight: string;                 // single most important insight
  analyzedAt: string;
}

// ── Config ───────────────────────────────────────────────────

const ANALYSIS_TIMEOUT_MS    = 30000;
const MAX_ARTICLES_PER_BATCH = 8;               // reduced from 10 for cost control
const DEDUP_CACHE_TTL        = 24 * 60 * 60 * 1000; // 24 hours

// ── Analysis window: Mon-Fri 06:00-17:00 WIB ─────────────────

export function isAnalysisHours(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hour = wib.getUTCHours();
  return hour >= 6 && hour < 17;
}

// ── In-memory dedup cache ────────────────────────────────────

const _analyzed = new Map<string, { analysis: NewsImpactAnalysis; timestamp: number }>();

// ── System prompt ────────────────────────────────────────────

const ANALYSIS_SYSTEM_PROMPT = `Kamu adalah sistem analisis berita pasar saham Indonesia (IDX) untuk platform BART.

TUGAS: Analisis dampak berita pada saham dan sektor IDX.

INSTRUKSI:
1. Klasifikasikan jenis dan tingkat keparahan event
2. Identifikasi saham/sektor IDX yang terdampak dengan mekanisme kausal yang jelas
3. Tentukan arah dampak (POSITIF/NEGATIF/NETRAL/MIXED), kekuatan (KUAT/SEDANG/LEMAH), dan horizon waktu
4. Tentukan apakah diperlukan macro override:
   - YES_HARD: event sistemik besar (sovereign downgrade, BI rate shock, krisis valuta, sanksi bursa)
   - YES_SOFT: event makro signifikan yang tidak langsung (perubahan kebijakan, peringatan OJK)
   - NO: event korporat atau sektoral biasa
5. Gunakan web_search jika perlu konteks tambahan (maksimal 2 kali)

RESPONS HARUS DALAM FORMAT JSON MURNI (tidak ada teks lain):
{
  "eventType": "SOVEREIGN_CREDIT_EVENT|MONETARY_POLICY|REGULATORY_CHANGE|COMMODITY_PRICE_MOVE|CORPORATE_ACTION|POLITICAL_EVENT|GLOBAL_MACRO|SECTOR_SPECIFIC|CURRENCY_EVENT|UNKNOWN",
  "eventSeverity": "CRITICAL|HIGH|MEDIUM|LOW",
  "affectedEntities": [
    {
      "type": "SECTOR|STOCK|BROAD_MARKET",
      "name": "nama sektor atau saham",
      "symbol": "TICKER atau null",
      "direction": "POSITIF|NEGATIF|NETRAL|MIXED",
      "strength": "KUAT|SEDANG|LEMAH",
      "timeHorizon": "IMMEDIATE|SHORT|MEDIUM",
      "mechanism": "penjelasan kausal dalam Bahasa Indonesia",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "macroOverride": "YES_HARD|YES_SOFT|NO",
  "macroOverrideReason": "alasan jika YES_HARD atau YES_SOFT, null jika NO",
  "traderImplication": "2-3 kalimat implikasi untuk trader IDX dalam Bahasa Indonesia",
  "requiresImmediateAttention": true|false,
  "expiryHorizon": "1_DAY|1_WEEK|1_MONTH|PERMANENT",
  "dataConfidence": "HIGH|MEDIUM|LOW",
  "rawInsight": "satu insight terpenting dari berita ini"
}`;

// ── JSON extraction ──────────────────────────────────────────

function extractJSON(text: string): NewsImpactAnalysis | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.eventType && parsed.affectedEntities) return parsed as NewsImpactAnalysis;
  } catch {
    // fall through
  }

  // Try to find JSON block in the text (Claude sometimes wraps in prose)
  const jsonMatch = text.match(/\{[\s\S]*"eventType"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.eventType && parsed.affectedEntities) return parsed as NewsImpactAnalysis;
    } catch {
      // fall through
    }
  }

  return null;
}

// ── Article prompt builder ───────────────────────────────────

function buildArticlePrompt(article: RawNewsArticle): string {
  const articleText = `${article.title}\n${article.summary}`;
  const matchedEvents = getMatchingCausalEvents(articleText);
  const macroCtx = buildMacroContext(matchedEvents);

  let prompt = `Analisis berita ini:

JUDUL: ${article.title}
SUMBER: ${article.source}
TANGGAL: ${article.publishedAt}
RINGKASAN: ${article.summary.slice(0, 500)}
URL: ${article.url || 'tidak tersedia'}`;

  if (macroCtx) {
    prompt += `\n\n${macroCtx}`;
  }

  prompt += `\n\nJika perlu konteks tambahan tentang dampak makro atau identifikasi saham terdampak, gunakan web_search.
Berikan respons dalam format JSON murni sesuai instruksi.`;

  return prompt;
}

// ── Single article analysis ──────────────────────────────────

export async function analyzeNewsImpact(
  article: RawNewsArticle,
  client: Anthropic
): Promise<NewsImpactAnalysis | null> {
  // Check dedup cache
  const cached = _analyzed.get(article.id);
  if (cached && Date.now() - cached.timestamp < DEDUP_CACHE_TTL) {
    return cached.analysis;
  }

  try {
    const response = await Promise.race<Anthropic.Message>([
      client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        tools: [
          {
            type: 'web_search_20250305' as 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          } as any,
        ],
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildArticlePrompt(article),
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Analysis timeout')), ANALYSIS_TIMEOUT_MS)
      ),
    ]);

    // Extract text from response (filter out tool_use blocks)
    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    const parsed = extractJSON(rawText);
    if (!parsed) {
      console.warn(`[newsAnalyzer] JSON parse failed for article: ${article.title.slice(0, 60)}`);
      return null;
    }

    const result: NewsImpactAnalysis = {
      articleId:                 article.id,
      eventType:                 parsed.eventType ?? 'UNKNOWN',
      eventSeverity:             parsed.eventSeverity ?? 'LOW',
      affectedEntities:          Array.isArray(parsed.affectedEntities) ? parsed.affectedEntities : [],
      macroOverride:             parsed.macroOverride ?? 'NO',
      macroOverrideReason:       parsed.macroOverrideReason ?? null,
      traderImplication:         parsed.traderImplication ?? '',
      requiresImmediateAttention: Boolean(parsed.requiresImmediateAttention),
      expiryHorizon:             parsed.expiryHorizon ?? '1_WEEK',
      dataConfidence:            parsed.dataConfidence ?? 'LOW',
      rawInsight:                parsed.rawInsight ?? '',
      analyzedAt:                new Date().toISOString(),
    };

    _analyzed.set(article.id, { analysis: result, timestamp: Date.now() });

    // Record cost using usage metadata when available
    const inputTokens  = (response as any).usage?.input_tokens  ?? 600;
    const outputTokens = (response as any).usage?.output_tokens ?? 900;
    const webSearchUses = response.content.filter(
      (b: any) => b.type === 'tool_use' && b.name === 'web_search'
    ).length;
    recordCost('news', inputTokens, outputTokens, webSearchUses);

    return result;

  } catch (err: any) {
    console.error(`[newsAnalyzer] Error analyzing "${article.title.slice(0, 60)}": ${err?.message ?? err}`);
    return null;
  }
}

// ── Batch processor ──────────────────────────────────────────

// Severity keywords — higher score = processed first
const SEVERITY_KEYWORDS = [
  'fitch', "moody's", "moody", 's&p', 'sovereign', 'sovereign downgrade',
  'msci', 'ftse rebalancing', 'bi rate', 'suku bunga acuan',
  'ojk sanksi', 'ojk suspend', 'sanksi bursa', 'downgrade', 'upgrade rating',
  'rupiah krisis', 'rupiah anjlok', 'capital flight',
  'default', 'gagal bayar', 'pailit', 'delisting', 'suspend',
  'krisis', 'bail out', 'resesi', 'sanctions',
];

export async function processArticleQueue(
  articles: RawNewsArticle[],
  client: Anthropic
): Promise<NewsImpactAnalysis[]> {
  if (!articles.length) return [];

  // Daily cost cap check
  if (isCapReached('news')) {
    console.log('[newsPipeline] Daily cost cap reached ($2.00), pausing news analysis until tomorrow');
    return [];
  }

  // Filter already-analyzed articles (SKIP_DUPLICATES)
  const unanalyzed = articles.filter((a) => {
    const cached = _analyzed.get(a.id);
    return !cached || Date.now() - cached.timestamp >= DEDUP_CACHE_TTL;
  });

  if (unanalyzed.length === 0) {
    console.log('[newsAnalyzer] All articles already in dedup cache, skipping');
    return [];
  }

  // Sort by severity — CRITICAL headlines first, then most recent
  const sorted = [...unanalyzed].sort((a, b) => {
    const aHaystack = (a.title + ' ' + a.summary).toLowerCase();
    const bHaystack = (b.title + ' ' + b.summary).toLowerCase();
    const aScore = SEVERITY_KEYWORDS.filter((k) => aHaystack.includes(k)).length;
    const bScore = SEVERITY_KEYWORDS.filter((k) => bHaystack.includes(k)).length;
    if (bScore !== aScore) return bScore - aScore;
    // Tiebreak: most recent first
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const batch = sorted.slice(0, MAX_ARTICLES_PER_BATCH);
  const results: NewsImpactAnalysis[] = [];

  for (const article of batch) {
    // Re-check cap before each article (cost accumulates mid-batch)
    if (isCapReached('news')) {
      console.log(`[newsPipeline] Daily cost cap reached mid-batch after ${results.length} articles`);
      break;
    }
    const analysis = await analyzeNewsImpact(article, client);
    if (analysis) results.push(analysis);
  }

  console.log(`[newsAnalyzer] Batch complete: ${results.length}/${batch.length} analyzed (${unanalyzed.length} unanalyzed, ${articles.length - unanalyzed.length} deduped)`);
  return results;
}

export function getAnalyzedCache(): Map<string, { analysis: NewsImpactAnalysis; timestamp: number }> {
  return _analyzed;
}

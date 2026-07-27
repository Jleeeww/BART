/**
 * ============================================================
 * XAI (GROK) CLIENT — social-media pulse v1.0
 * ============================================================
 * server/engine/xaiClient.ts
 *
 * Grok's Live Search (sources: x) is the only piece of this stack that
 * reads real-time social media — Claude's web_search (used everywhere
 * else in the app) covers news/analyst sources, not X/Twitter chatter.
 * Used by thematicScanner.ts to add a "how is social media reading this"
 * signal on top of the news-driven theme/flag overlay. Optional: no-ops
 * (returns null) if XAI_API_KEY is absent, the daily call cap is hit, or
 * the request fails — callers must treat this as best-effort enrichment.
 */

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';
const MODEL = 'grok-4-fast';
const CALL_TIMEOUT_MS = 30_000;

export function xaiEnabled(): boolean {
  return !!process.env.XAI_API_KEY;
}

// No shared $-cost tracker exists for Grok yet (costTracker.ts is priced for
// Claude only) — this just bounds worst-case call volume to a handful/day.
const DAILY_CALL_CAP = 4;
let capDayKey = '';
let callsToday = 0;
function underDailyCap(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== capDayKey) { capDayKey = today; callsToday = 0; }
  return callsToday < DAILY_CALL_CAP;
}

export type SocialDirection = 'POSITIF' | 'NEGATIF' | 'NETRAL';

export interface SocialPulse {
  narrative: string;                            // Bahasa ID, 1-2 kalimat
  bySymbol: Record<string, SocialDirection>;
  sources: string[];
}

function parseJSON<T>(text: string): T | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const m = t.match(/[\{\[][\s\S]*[\}\]]/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

const SYSTEM_PROMPT = `Kamu membaca arah pembicaraan di media sosial (utamanya X/Twitter) terkait pasar saham Indonesia (IDX).
Gunakan live search X untuk mencari cuitan/diskusi hari ini tentang tema pasar dan saham yang diberikan.

ATURAN:
- Hanya laporkan simbol yang benar-benar punya diskusi terlihat di X. JANGAN mengarang.
- Bahasa aman-OJK: ini bacaan sentimen sosial, BUKAN rekomendasi beli/jual atau target harga.
- Bahasa Indonesia. Balas HANYA JSON murni (tanpa prosa/markdown), format:
{"narrative": "ringkasan 1-2 kalimat soal mood media sosial hari ini", "bySymbol": {"SYMBOL": "POSITIF|NEGATIF|NETRAL"}}`;

/**
 * Ask Grok (Live Search over X) how social media is reading today's themes
 * for a shortlist of tickers. Returns null on any failure/skip condition —
 * never throws.
 */
export async function getSocialPulse(
  themesSummary: string,
  candidateSymbols: string[],
): Promise<SocialPulse | null> {
  if (!xaiEnabled() || candidateSymbols.length === 0 || !underDailyCap()) return null;
  callsToday++;

  const userPrompt = `TEMA PASAR HARI INI:\n${themesSummary}\n\nSAHAM KANDIDAT: ${candidateSymbols.join(', ')}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(XAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          search_parameters: {
            mode: 'on',
            sources: [{ type: 'x' }],
            return_citations: true,
          },
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.warn(`[xaiClient] grok ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const citations: string[] = Array.isArray(data?.citations) ? data.citations : [];
    const parsed = parseJSON<{ narrative?: string; bySymbol?: Record<string, string> }>(text);
    if (!parsed) return null;

    const bySymbol: Record<string, SocialDirection> = {};
    for (const [sym, dir] of Object.entries(parsed.bySymbol ?? {})) {
      if (dir === 'POSITIF' || dir === 'NEGATIF' || dir === 'NETRAL') {
        bySymbol[sym.toUpperCase()] = dir;
      }
    }
    return { narrative: (parsed.narrative || '').trim(), bySymbol, sources: citations };
  } catch (err) {
    console.warn(`[xaiClient] error: ${err}`);
    return null;
  }
}

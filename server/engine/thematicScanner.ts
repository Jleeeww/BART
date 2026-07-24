/**
 * ============================================================
 * THEMATIC EVENT SCANNER (Layer 8) v1.0
 * ============================================================
 * server/engine/thematicScanner.ts
 *
 * OVERLAY ONLY — NEVER IMPORT SCORING.
 * This module is a pure labeled interpretation overlay. It writes ONLY the
 * `thematic_scan` and `thematic_stock_flags` tables and MUST NOT import
 * compositeEngineV3 / stockReadiness, nor be imported by them. The deterministic
 * score is never touched by anything here. (See the architectural law in the plan.)
 *
 * It scales the per-stock News layer to the whole market: one LLM analyst reading
 * today's catalysts twice daily → theme → sector → flagged stocks, all in Bahasa
 * Indonesia under an explicit "Interpretasi AI" label, OJK-safe (no buy/sell recs,
 * no price targets).
 *
 * Reuses:
 *   - Claude call pattern from newsAnalyzer.ts (claude-sonnet-4-5 + web_search_20250305)
 *   - macroCausalKnowledge.ts as the sector-mapping brain
 *   - costTracker 'thematic' pipeline ($1.50/day own cap + $5 global circuit breaker)
 * ============================================================
 */

import type Anthropic from '@anthropic-ai/sdk';
import { getMatchingCausalEvents, buildMacroContext } from './macroCausalKnowledge';
import { recordCost, isCapReached } from './costTracker';

const MODEL = 'claude-sonnet-4-5';
const CALL_TIMEOUT_MS = 40_000;
const MAX_FLAGGED = 10;           // deep-analyze only a flagged handful, never all 45

export type ScanSlot = 'AM' | 'MIDDAY' | 'MANUAL';
export type ScanStatus = 'OK' | 'NO_CATALYST' | 'SKIPPED_COST' | 'ERROR';

export interface ThematicTheme {
  id: string;
  title: string;
  summary: string;
  category: string;       // e.g. KOMODITAS | MONETER | GEOPOLITIK | REGULASI | GLOBAL
  keywords: string[];
  confidence: string;     // TINGGI | SEDANG | RENDAH
}

export interface ThematicFlag {
  symbol: string;
  theme: string;
  direction: 'POSITIF' | 'NEGATIF' | 'NETRAL';
  sector: string | null;
  rationale: string;
  confidence: string;     // TINGGI | SEDANG | RENDAH
  sourceUrls: string[];
}

export interface ThematicScanResult {
  status: ScanStatus;
  slot: ScanSlot;
  themes: ThematicTheme[];
  flags: ThematicFlag[];
  narrative: string;      // Bahasa ID "Interpretasi AI" summary
  eventCount: number;
  costUsd: number;
  webSearches: number;
  model: string;
}

// ── System prompts (Bahasa Indonesia, OJK-safe) ──────────────────

const DISCOVERY_SYSTEM_PROMPT = `Kamu adalah analis pasar saham Indonesia (IDX) yang tajam dan jujur.
Tugasmu: memindai berita dan peristiwa global/domestik HARI INI yang berpotensi material bagi pasar saham Indonesia.
Gunakan web_search untuk menemukan katalis nyata dan terkini (kebijakan BI/pemerintah, komoditas, kurs, geopolitik, rating, sektor).

ATURAN KETAT:
- Hanya laporkan tema yang benar-benar ada di berita. JANGAN mengarang tema.
- Jika tidak ada katalis signifikan hari ini, kembalikan themes: [] (array kosong).
- Bahasa Indonesia. Bahasa aman-OJK: gunakan "Analisis menunjukkan", BUKAN "Kami merekomendasikan".
- JANGAN memberi rekomendasi beli/jual atau target harga.

Balas HANYA dengan JSON murni (tanpa prosa), format:
{
  "themes": [
    { "id": "kebab-case-id", "title": "...", "summary": "...", "category": "KOMODITAS|MONETER|GEOPOLITIK|REGULASI|GLOBAL|LAINNYA", "keywords": ["..."], "confidence": "TINGGI|SEDANG|RENDAH" }
  ],
  "narrative": "Ringkasan 1-2 kalimat kondisi tema pasar hari ini."
}`;

const FLAGGING_SYSTEM_PROMPT = `Kamu adalah analis IDX. Diberikan daftar tema pasar hari ini dan daftar saham (simbol + sektor),
tentukan saham mana yang paling terdampak dan ke arah mana.

CARA MEMETAKAN:
- Tema makro/indeks WAJIB diterjemahkan ke saham perwakilan sektor yang terdampak. Contoh:
  • Basic Materials / semen → SMGR, INTP, ANTM, INCO
  • Properti / Real Estate → BSDE, CTRA, PWON, SMRA
  • Kenaikan suku bunga (BI rate) → bank (BBRI, BBNI, BMRI, BBCA) cenderung NEGATIF jangka pendek; properti NEGATIF
  • Rupiah melemah / yield US tinggi → saham utang USD tinggi & impor NEGATIF; eksportir komoditas (AALI, ADRO, PTBA) bisa POSITIF
  • Energi/minyak → ADRO, PTBA, ITMG, MEDC, BREN
- Pilih saham HANYA dari DAFTAR SAHAM yang diberikan (pakai simbol persis).

ATURAN:
- Maksimal ${MAX_FLAGGED} saham, prioritaskan yang paling terdampak.
- JANGAN kembalikan array kosong jika tema jelas menyebut sektor yang ada di daftar saham — selalu petakan ke minimal beberapa saham perwakilan.
- Untuk tiap saham: arah (POSITIF/NEGATIF/NETRAL) + alasan kausal singkat + tingkat keyakinan.
- Ini INTERPRETASI, bukan prediksi harga dan bukan rekomendasi. Bahasa aman-OJK.
- Sertakan sourceUrls bila ada. Bahasa Indonesia. Balas HANYA JSON murni (tanpa prosa/markdown).

Format:
{
  "flags": [
    { "symbol": "BBRI", "theme": "judul-tema", "direction": "POSITIF|NEGATIF|NETRAL", "sector": "...", "rationale": "...", "confidence": "TINGGI|SEDANG|RENDAH", "sourceUrls": ["..."] }
  ]
}`;

// Sektor yang sering disebut di tema → kata kunci untuk mencocokkan sektor universe.
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Financials':       ['bank', 'perbankan', 'suku bunga', 'bi rate', 'kredit', 'financial'],
  'Real Estate':      ['properti', 'property', 'real estate', 'perumahan'],
  'Basic Materials':  ['basic materials', 'material', 'semen', 'logam', 'tambang logam', 'nikel', 'baja'],
  'Energy':           ['energi', 'energy', 'batu bara', 'batubara', 'minyak', 'oil', 'coal', 'migas'],
  'Consumer Staples': ['konsumsi', 'consumer', 'cpo', 'sawit', 'pangan'],
  'Technology':       ['teknologi', 'technology', 'digital', 'startup'],
  'Infrastructure':   ['infrastruktur', 'infrastructure', 'konstruksi', 'jalan tol'],
  'Industrials':      ['industri', 'industrial', 'otomotif', 'manufaktur'],
};

// ── Helpers ──────────────────────────────────────────────────────

async function getClient(): Promise<Anthropic | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
  return new AnthropicSDK({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();
}

function parseJSON<T>(text: string): T | null {
  // Strip markdown code fences (```json … ```) the model often wraps around JSON.
  let t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const m = t.match(/[\{\[][\s\S]*[\}\]]/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through */ }
    }
    // Salvage truncated JSON: collect every complete {...} object substring.
    const salvaged = salvageObjects(t);
    if (salvaged.length) return salvaged as unknown as T;
    return null;
  }
}

// Collect every balanced-brace {...} substring that parses as JSON. Recovers
// individual flag/theme objects when the outer array/object is truncated.
function salvageObjects(text: string): any[] {
  const objs: any[] = [];
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') stack.push(i);
    else if (text[i] === '}' && stack.length) {
      const start = stack.pop()!;
      if (stack.length === 0) {
        try { objs.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip */ }
      }
    }
  }
  // If nothing at depth 0 parsed (outer object never closed), retry ignoring depth.
  if (objs.length === 0) {
    const stack2: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') stack2.push(i);
      else if (text[i] === '}' && stack2.length) {
        const start = stack2.pop()!;
        try { const o = JSON.parse(text.slice(start, i + 1)); if (o.symbol || o.title || o.id) objs.push(o); } catch { /* skip */ }
      }
    }
  }
  return objs;
}

function countWebSearches(response: Anthropic.Message): number {
  return response.content.filter(
    (b: any) => b.type === 'tool_use' && b.name === 'web_search'
  ).length;
}

async function callClaude(
  client: Anthropic,
  system: string,
  user: string,
  maxTokens: number,
  webSearch: boolean
): Promise<{ response: Anthropic.Message; cost: number; webSearches: number }> {
  const response = await Promise.race<Anthropic.Message>([
    client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      ...(webSearch
        ? { tools: [{ type: 'web_search_20250305' as 'web_search_20250305', name: 'web_search', max_uses: 3 } as any] }
        : {}),
      system,
      messages: [{ role: 'user', content: user }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('thematic call timeout')), CALL_TIMEOUT_MS)
    ),
  ]);

  const inputTokens  = (response as any).usage?.input_tokens  ?? 1000;
  const outputTokens = (response as any).usage?.output_tokens ?? 1200;
  const webSearches  = countWebSearches(response);
  const cost = recordCost('thematic', inputTokens, outputTokens, webSearches);
  return { response, cost, webSearches };
}

/** Fetch the tradable universe (symbol + sector) from the running server. */
async function fetchUniverse(): Promise<Array<{ symbol: string; sector: string | null }>> {
  try {
    const port = process.env.PORT || 3000;
    const res = await fetch(`http://localhost:${port}/api/stocks`);
    if (!res.ok) return [];
    const rows = (await res.json()) as any[];
    return rows.map((r) => ({ symbol: r.symbol, sector: r.sector ?? null }));
  } catch {
    return [];
  }
}

// ── Main entry ───────────────────────────────────────────────────

const EMPTY_RESULT = (slot: ScanSlot, status: ScanStatus, narrative: string): ThematicScanResult => ({
  status, slot, themes: [], flags: [], narrative, eventCount: 0, costUsd: 0, webSearches: 0, model: MODEL,
});

/**
 * Run one market-wide thematic scan and PERSIST it (thematic_scan + flags).
 * Returns the result for immediate serving. Never throws.
 */
export async function runThematicScan(slot: ScanSlot): Promise<ThematicScanResult> {
  const client = await getClient();
  if (!client) {
    return EMPTY_RESULT(slot, 'ERROR', 'Tidak ada data tema hari ini (ANTHROPIC_API_KEY belum dikonfigurasi).');
  }
  if (isCapReached('thematic')) {
    const r = EMPTY_RESULT(slot, 'SKIPPED_COST', 'Pemindaian tema dilewati hari ini (batas biaya tercapai).');
    await persist(r).catch(() => {});
    return r;
  }

  let totalCost = 0;
  let totalSearches = 0;

  try {
    // ── Step 1+2: event discovery + theme extraction ──────────────
    const today = new Date().toISOString().slice(0, 10);
    const discovery = await callClaude(
      client,
      DISCOVERY_SYSTEM_PROMPT,
      `Tanggal: ${today}. Cari katalis pasar IDX yang material hari ini (berita Indonesia + peristiwa global yang memengaruhi pasar Asia/EM). ` +
        `Distilkan menjadi 3-6 tema diskret. Ringkas setiap summary (maks 2 kalimat) agar JSON tidak terpotong. Balas JSON murni.`,
      3000,
      true
    );
    totalCost += discovery.cost;
    totalSearches += discovery.webSearches;

    const discoveryText = extractText(discovery.response);
    const parsed = parseJSON<any>(discoveryText);
    // Accept {themes:[...]}, a bare array, or {tema:[...]} shapes.
    const themes: ThematicTheme[] = (Array.isArray(parsed?.themes) ? parsed.themes
      : Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.tema) ? parsed.tema
      : []).filter((t: any) => t && (t.title || t.id)); // drop salvaged wrapper objects
    const narrative = parsed?.narrative?.trim() || (themes.length ? 'Beberapa tema pasar terdeteksi hari ini.' : 'Tidak ada katalis signifikan hari ini.');
    if (themes.length === 0) {
      console.warn(`[thematicScanner] discovery parsed 0 themes (len=${discoveryText.length}). raw (500 chars): ${discoveryText.slice(0, 500)}`);
    } else {
      console.log(`[thematicScanner] discovery themes=${themes.length}`);
    }

    if (themes.length === 0) {
      const r: ThematicScanResult = {
        status: 'NO_CATALYST', slot, themes: [], flags: [],
        narrative: 'Tidak ada katalis signifikan hari ini.',
        eventCount: 0, costUsd: totalCost, webSearches: totalSearches, model: MODEL,
      };
      await persist(r).catch(() => {});
      return r;
    }

    // ── Step 3: sector mapping (deterministic — reuses causal KB, no API cost) ──
    const allThemeText = themes.map((t) => `${t.title} ${t.summary} ${(t.keywords || []).join(' ')}`).join('\n');
    const causalEvents = getMatchingCausalEvents(allThemeText);
    const macroContext = buildMacroContext(causalEvents); // '' if nothing matched

    // ── Step 4: stock flagging (ONE Claude call; output hard-capped) ──
    let flags: ThematicFlag[] = [];
    if (!isCapReached('thematic')) {
      const universe = await fetchUniverse();
      const universeStr = universe.length
        ? universe.map((u) => `${u.symbol} (${u.sector ?? 'n/a'})`).join(', ')
        : '(daftar saham tidak tersedia — gunakan pengetahuan umum saham LQ45)';
      const themesStr = themes.map((t) => `- [${t.category}] ${t.title}: ${t.summary}`).join('\n');

      // Deterministic candidate shortlist: universe stocks whose sector matches
      // sectors referenced in the theme text (via causal KB + keyword map). Anchors
      // Claude to concrete tickers so macro/index themes don't yield an empty list.
      const themeLower = allThemeText.toLowerCase();
      const affectedSectors = new Set<string>(causalEvents.flatMap((e) => e.affectedSectors));
      for (const [sector, kws] of Object.entries(SECTOR_KEYWORDS)) {
        if (kws.some((k) => themeLower.includes(k))) affectedSectors.add(sector);
      }
      const sectorList = Array.from(affectedSectors);
      const candidates = universe
        .filter((u) => u.sector && sectorList.some((s) => (u.sector as string).toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes((u.sector as string).toLowerCase())))
        .map((u) => u.symbol);
      const candidateStr = candidates.length
        ? `KANDIDAT PALING RELEVAN (sektor terdampak — fokus di sini):\n${candidates.join(', ')}\n\n`
        : '';

      console.log(`[thematicScanner] universe=${universe.length} affectedSectors=${sectorList.join('|') || 'none'} candidates=${candidates.length}`);

      const flagging = await callClaude(
        client,
        FLAGGING_SYSTEM_PROMPT,
        `TEMA HARI INI:\n${themesStr}\n\n` +
          (macroContext ? `${macroContext}\n\n` : '') +
          candidateStr +
          `DAFTAR SAHAM (simbol + sektor):\n${universeStr}\n\n` +
          `Tandai maksimal ${MAX_FLAGGED} saham paling terdampak. rationale MAKS 1 kalimat singkat agar JSON tidak terpotong. Jangan array kosong bila sektor jelas terdampak. Balas JSON murni.`,
        3500,
        true
      );
      totalCost += flagging.cost;
      totalSearches += flagging.webSearches;

      const flaggingText = extractText(flagging.response);
      const fParsed = parseJSON<any>(flaggingText);
      // Accept {flags:[...]}, a bare array, or {saham:[...]} shapes.
      const rawFlags: any[] = Array.isArray(fParsed?.flags) ? fParsed.flags
        : Array.isArray(fParsed) ? fParsed
        : Array.isArray(fParsed?.saham) ? fParsed.saham
        : [];
      if (rawFlags.length === 0) {
        console.warn(`[thematicScanner] 0 flags parsed. candidates=${candidates.length}. raw response (400 chars): ${flaggingText.slice(0, 400)}`);
      }
      flags = rawFlags.slice(0, MAX_FLAGGED).map((f) => ({
        symbol: String(f.symbol || '').toUpperCase(),
        theme: f.theme || '',
        direction: (['POSITIF', 'NEGATIF', 'NETRAL'].includes(f.direction as string) ? f.direction : 'NETRAL') as ThematicFlag['direction'],
        sector: f.sector ?? null,
        rationale: f.rationale || '',
        confidence: f.confidence || 'RENDAH',
        sourceUrls: Array.isArray(f.sourceUrls) ? f.sourceUrls : [],
      })).filter((f) => f.symbol);

      // Deterministic safety net: if the LLM flagged nothing but sectors are
      // clearly impacted, surface sector representatives as NETRAL (honest,
      // labeled) so the overlay is never empty when the theme touches the universe.
      if (flags.length === 0 && candidates.length > 0) {
        const bySector = new Map<string, string[]>();
        for (const u of universe) {
          if (!u.sector || !candidates.includes(u.symbol)) continue;
          const arr = bySector.get(u.sector) ?? [];
          if (arr.length < 2) { arr.push(u.symbol); bySector.set(u.sector, arr); }
        }
        const fallbackTheme = themes[0]?.title ?? 'Tema pasar';
        const fb: ThematicFlag[] = [];
        for (const [sector, syms] of Array.from(bySector.entries())) {
          for (const sym of syms) {
            if (fb.length >= MAX_FLAGGED) break;
            fb.push({
              symbol: sym, theme: fallbackTheme, direction: 'NETRAL', sector,
              rationale: `Sektor ${sector} termasuk yang disorot tema pasar hari ini. Arah spesifik belum dinilai AI — pantau perkembangan.`,
              confidence: 'RENDAH', sourceUrls: [],
            });
          }
          if (fb.length >= MAX_FLAGGED) break;
        }
        flags = fb;
        console.warn(`[thematicScanner] LLM returned 0 flags → deterministic fallback used: ${fb.length}`);
      }
    }

    const result: ThematicScanResult = {
      status: 'OK', slot, themes, flags, narrative,
      eventCount: themes.length, costUsd: totalCost, webSearches: totalSearches, model: MODEL,
    };
    await persist(result).catch(() => {});
    return result;
  } catch (err: any) {
    console.error(`[thematicScanner] scan error: ${err?.message ?? err}`);
    return {
      status: 'ERROR', slot, themes: [], flags: [],
      narrative: 'Tidak ada data tema hari ini (terjadi kesalahan saat pemindaian).',
      eventCount: 0, costUsd: totalCost, webSearches: totalSearches, model: MODEL,
    };
  }
}

/** Persist a scan + its flags via the storage layer. */
async function persist(result: ThematicScanResult): Promise<void> {
  const { storage } = await import('../storage');
  const scan = await storage.createThematicScan({
    slot: result.slot,
    status: result.status,
    themes: result.themes,
    narrative: result.narrative,
    eventCount: result.eventCount,
    costUsd: String(result.costUsd),
    webSearches: result.webSearches,
    model: result.model,
  });
  if (result.flags.length) {
    await storage.insertThematicFlags(
      scan.id,
      result.flags.map((f) => ({
        scanId: scan.id,
        symbol: f.symbol,
        theme: f.theme,
        direction: f.direction,
        sector: f.sector,
        rationale: f.rationale,
        confidence: f.confidence,
        sourceUrls: f.sourceUrls,
      }))
    );
  }
}

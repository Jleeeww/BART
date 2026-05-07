/**
 * ============================================================
 * MANAGEMENT RESEARCH v1.0
 * ============================================================
 * server/engine/managementResearch.ts
 *
 * BOD research pipeline via Claude web search.
 * One Claude call per person, 5 web searches covering:
 *   1. Identity & education verification
 *   2. Career history & progression at IDX companies
 *   3. Track record (performance under their leadership)
 *   4. Red flags (OJK sanctions, legal, controversy)
 *   5. Recent news (last 12 months)
 *
 * RELIABILITY TIERS:
 *   HIGH        — 3+ verifiable sources found
 *   MEDIUM      — 1-2 limited sources found
 *   LOW         — minimal public information
 *   INSUFFICIENT — person not identifiable; excluded from scoring
 *
 * COST CONTROLS:
 *   - max_uses: 5 per person
 *   - 7-day in-memory cache per (symbol::name)
 *   - 45s per-person timeout
 *   - Returns null on any failure — never throws
 * ============================================================
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Types ────────────────────────────────────────────────────

export interface BODMember {
  name:  string;
  title: string;
}

export type RedFlagType =
  | 'CRIMINAL_CONVICTION'
  | 'REGULATORY_SANCTION_OJK'
  | 'FRAUD_PROVEN'
  | 'INSIDER_TRADING_SANCTION'
  | 'ASSET_FLIGHT'
  | 'CONFLICT_OF_INTEREST_CRITICAL';

export type RedFlagSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';
export type ReliabilityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export interface RedFlag {
  type:        RedFlagType;
  severity:    RedFlagSeverity;
  description: string;
  source:      string;
}

export interface BODMemberProfile {
  name:        string;
  title:       string;
  symbol:      string;
  companyName: string;

  // Dimension scores 0-100 (null = no data for that dimension)
  trackRecordScore:      number | null;
  governanceScore:       number | null;
  insiderAlignmentScore: number | null;
  stabilityScore:        number | null;
  reputationScore:       number | null;

  // Qualitative summaries in Bahasa Indonesia
  trackRecordSummary:    string;
  governanceSummary:     string;
  reputationSummary:     string;
  insiderAlignmentNote:  string;
  stabilityNote:         string;
  keyInsight:            string;

  redFlags:            RedFlag[];
  hasCriticalRedFlag:  boolean;
  reliability:         ReliabilityTier;
  rawFindings:         string;
  researchedAt:        string;
}

// ── Config ───────────────────────────────────────────────────

const RESEARCH_TIMEOUT_MS = 45000;
const CACHE_TTL_MS        = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── In-memory cache ──────────────────────────────────────────
// Key: `${SYMBOL}::${name.toLowerCase().trim()}`

const _profileCache = new Map<string, { profile: BODMemberProfile; timestamp: number }>();

// ── System prompt ────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `Kamu adalah peneliti tata kelola korporat untuk platform BART yang menganalisis eksekutif perusahaan IDX Indonesia.

TUGAS: Riset eksekutif ini secara menyeluruh menggunakan web_search (maks 5 pencarian).

ALOKASI PENCARIAN (gunakan sesuai kebutuhan):
1. Identitas & latar belakang: nama lengkap, pendidikan, profil resmi perusahaan
2. Karier: jabatan sebelumnya di perusahaan IDX/BUMN, lama menjabat
3. Rekam jejak: performa perusahaan di bawah kepemimpinannya (pertumbuhan laba, harga saham)
4. Red flag: sanksi OJK, kasus hukum, investigasi, pelanggaran tata kelola
5. Berita terkini: 12 bulan terakhir — pernyataan publik, resign/pengangkatan, kontroversi

KRITERIA RED FLAG KRITIS (hasCriticalRedFlag = true):
- Vonis pidana aktif atau tuntutan pidana yang sedang berjalan
- Sanksi OJK berupa larangan kegiatan di pasar modal
- Terbukti melakukan penipuan/penggelapan korporat
- Sanksi resmi insider trading dari OJK/Bapepam
- Pelarian aset atau pembekuan rekening oleh pengadilan

PENILAIAN RELIABILITAS:
- HIGH: ditemukan 3+ sumber terpercaya (situs resmi perusahaan, Bloomberg, Reuters, OJK, Bisnis Indonesia)
- MEDIUM: 1-2 sumber terbatas atau informasi parsial
- LOW: hampir tidak ada informasi publik
- INSUFFICIENT: person tidak dapat diidentifikasi atau tidak relevan dengan perusahaan IDX ini

RESPONS WAJIB DALAM FORMAT JSON MURNI (tidak ada teks lain):
{
  "identified": true,
  "trackRecordScore": 0-100,
  "trackRecordSummary": "3-4 kalimat ringkasan rekam jejak sebagai eksekutif",
  "governanceScore": 0-100,
  "governanceSummary": "temuan tata kelola, kepatuhan OJK, transparansi",
  "insiderAlignmentScore": 0-100,
  "insiderAlignmentNote": "kepemilikan saham pribadi, arah transaksi insider terkini",
  "stabilityScore": 0-100,
  "stabilityNote": "lama menjabat, historis perpindahan jabatan",
  "reputationScore": 0-100,
  "reputationSummary": "reputasi publik, penghargaan industri, kontroversi non-kritis",
  "keyInsight": "insight terpenting tentang eksekutif ini untuk investor IDX",
  "redFlags": [
    {
      "type": "CRIMINAL_CONVICTION|REGULATORY_SANCTION_OJK|FRAUD_PROVEN|INSIDER_TRADING_SANCTION|ASSET_FLIGHT|CONFLICT_OF_INTEREST_CRITICAL",
      "severity": "CRITICAL|HIGH|MEDIUM",
      "description": "penjelasan spesifik dengan tanggal dan sumber",
      "source": "nama sumber"
    }
  ],
  "hasCriticalRedFlag": false,
  "reliability": "HIGH|MEDIUM|LOW|INSUFFICIENT"
}`;

// ── JSON extraction ──────────────────────────────────────────

function extractProfileJSON(text: string): Partial<BODMemberProfile> | null {
  try {
    const parsed = JSON.parse(text.trim());
    if (typeof parsed.reliability === 'string') return parsed;
  } catch { /* fall through */ }

  // Slice from first '{' to last '}' — avoids catastrophic backtracking on large inputs
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (typeof parsed.reliability === 'string') return parsed;
    } catch { /* fall through */ }
  }

  return null;
}

// ── Single-person research ───────────────────────────────────

export async function researchBODMember(
  member:      BODMember,
  symbol:      string,
  companyName: string,
  client:      Anthropic
): Promise<BODMemberProfile | null> {
  const cacheKey = `${symbol.toUpperCase()}::${member.name.toLowerCase().trim()}`;

  const cached = _profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.profile;
  }

  try {
    const response = await Promise.race<Anthropic.Message>([
      client.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [
          {
            type:     'web_search_20250305' as 'web_search_20250305',
            name:     'web_search',
            max_uses: 5,
          } as any,
        ],
        system:   RESEARCH_SYSTEM_PROMPT,
        messages: [
          {
            role:    'user',
            content:
              `Riset eksekutif berikut:\n\n` +
              `NAMA: ${member.name}\n` +
              `JABATAN: ${member.title}\n` +
              `PERUSAHAAN: ${companyName} (${symbol}) — tercatat di IDX Indonesia\n\n` +
              `Gunakan web_search untuk mengumpulkan informasi. ` +
              `Pastikan mencari red flag dari OJK/Bapepam dan berita negatif. ` +
              `Berikan respons dalam format JSON murni sesuai instruksi.`,
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Research timeout')), RESEARCH_TIMEOUT_MS)
      ),
    ]);

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b)   => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    const parsed = extractProfileJSON(rawText);
    if (!parsed) {
      console.warn(`[mgmtResearch] JSON parse failed for ${member.name} (${symbol})`);
      return null;
    }

    const profile: BODMemberProfile = {
      name:                 member.name,
      title:                member.title,
      symbol:               symbol.toUpperCase(),
      companyName,
      trackRecordScore:     typeof parsed.trackRecordScore === 'number'      ? parsed.trackRecordScore      : null,
      governanceScore:      typeof parsed.governanceScore === 'number'       ? parsed.governanceScore       : null,
      insiderAlignmentScore:typeof parsed.insiderAlignmentScore === 'number' ? parsed.insiderAlignmentScore : null,
      stabilityScore:       typeof parsed.stabilityScore === 'number'        ? parsed.stabilityScore        : null,
      reputationScore:      typeof parsed.reputationScore === 'number'       ? parsed.reputationScore       : null,
      trackRecordSummary:   parsed.trackRecordSummary    ?? '',
      governanceSummary:    parsed.governanceSummary     ?? '',
      reputationSummary:    parsed.reputationSummary     ?? '',
      insiderAlignmentNote: parsed.insiderAlignmentNote  ?? '',
      stabilityNote:        parsed.stabilityNote         ?? '',
      keyInsight:           parsed.keyInsight            ?? '',
      redFlags:             Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      hasCriticalRedFlag:   Boolean(parsed.hasCriticalRedFlag) ||
        (Array.isArray(parsed.redFlags) &&
          (parsed.redFlags as any[]).some((f: any) => f.severity === 'CRITICAL')),
      reliability:          (parsed.reliability as ReliabilityTier) ?? 'LOW',
      rawFindings:          rawText.slice(0, 3000),
      researchedAt:         new Date().toISOString(),
    };

    _profileCache.set(cacheKey, { profile, timestamp: Date.now() });
    return profile;

  } catch (err: any) {
    console.error(`[mgmtResearch] Error researching "${member.name}" (${symbol}): ${err?.message ?? err}`);
    return null;
  }
}

// ── Full BOD research ────────────────────────────────────────

export async function researchManagement(
  members:     BODMember[],
  symbol:      string,
  companyName: string,
  client:      Anthropic
): Promise<BODMemberProfile[]> {
  const profiles: BODMemberProfile[] = [];

  for (const member of members) {
    const profile = await researchBODMember(member, symbol, companyName, client);
    if (profile) profiles.push(profile);
  }

  console.log(`[mgmtResearch] ${symbol}: ${profiles.length}/${members.length} profiles researched`);
  return profiles;
}

// ── Cache accessors ──────────────────────────────────────────

export function getCachedProfiles(symbol: string): BODMemberProfile[] {
  const prefix = `${symbol.toUpperCase()}::`;
  const now    = Date.now();
  const result: BODMemberProfile[] = [];

  for (const [key, entry] of Array.from(_profileCache.entries())) {
    if (key.startsWith(prefix) && now - entry.timestamp < CACHE_TTL_MS) {
      result.push(entry.profile);
    }
  }

  return result;
}

export function getProfileCacheStats(): { total: number; bySymbol: Record<string, number> } {
  const bySymbol: Record<string, number> = {};

  for (const key of Array.from(_profileCache.keys())) {
    const sym = key.split('::')[0];
    bySymbol[sym] = (bySymbol[sym] ?? 0) + 1;
  }

  return { total: _profileCache.size, bySymbol };
}

/**
 * ============================================================
 * INSIDER RESEARCH v1.0
 * ============================================================
 * server/engine/insiderResearch.ts
 *
 * Researches OJK/IDX insider transaction filings via Claude web search.
 * Finds director and commissioner trades in their own company's stock.
 *
 * SEARCH STRATEGY (4 queries per symbol):
 *   1. IDX e-reporting laporan kepemilikan saham direktur/komisaris
 *   2. OJK disclosure database
 *   3. Director buys in target year
 *   4. Media verification (Bisnis Indonesia / Kontan)
 *
 * COST CONTROLS:
 *   - max_uses: 4 per symbol
 *   - 24h in-memory cache per symbol
 *   - 60s per-symbol timeout
 *   - Returns [] on any failure — never throws
 * ============================================================
 */

import Anthropic from '@anthropic-ai/sdk';

// ── Types ────────────────────────────────────────────────────

export interface InsiderTransaction {
  symbol:          string;
  personName:      string;
  role:            string;
  transactionType: 'BUY' | 'SELL';
  transactionDate: string;   // ISO YYYY-MM-DD
  filingDate:      string;   // ISO YYYY-MM-DD
  filingDelayDays: number;
  shares:          number;
  pricePerShare:   number;   // IDR
  totalValue:      number;   // IDR
  priceAtFiling:   number;   // IDR stock price on filing date (for context)
  source:          string;   // URL of filing
  reliability:     'HIGH' | 'MEDIUM' | 'LOW';
}

// ── Config ───────────────────────────────────────────────────

const RESEARCH_TIMEOUT_MS = 60_000;
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── In-memory cache ──────────────────────────────────────────
// Key: symbol (uppercase)

const _cache = new Map<string, { transactions: InsiderTransaction[]; timestamp: number }>();

// ── System prompt ────────────────────────────────────────────

const RESEARCH_SYSTEM_PROMPT = `Kamu adalah analis transaksi insider untuk platform BART yang mencari laporan kepemilikan saham direktur dan komisaris IDX Indonesia.

TUGAS: Cari transaksi insider (pembelian/penjualan saham oleh direktur dan komisaris) untuk saham IDX yang diminta. Gunakan 4 web_search yang tersedia secara efisien.

ALOKASI PENCARIAN (4 total):
1. "{SYMBOL} laporan kepemilikan saham direktur komisaris {YEAR}" — prioritaskan idx.co.id/keterbukaan-informasi
2. "{SYMBOL} insider transaction OJK disclosure {YEAR}"
3. "{SYMBOL} direktur beli jual saham {YEAR}" — Bisnis Indonesia, Kontan, CNBC Indonesia
4. Verifikasi transaksi spesifik yang ditemukan atau pencarian lebih lanjut

YANG HARUS DICARI PER TRANSAKSI:
- Nama lengkap orang yang bertransaksi
- Jabatan (Direktur Utama, Direktur, Komisaris Utama, Komisaris Independen, dst)
- Jenis transaksi: BELI → BUY, JUAL → SELL
- Tanggal transaksi (bukan tanggal filing/pelaporan)
- Tanggal filing/pelaporan ke OJK/IDX
- Jumlah saham yang diperdagangkan
- Harga per saham (IDR)
- Total nilai transaksi (IDR = shares × harga)
- Harga saham saat filing (perkiraan dari harga pasar tanggal filing)
- URL sumber dokumen/berita

KRITERIA RELIABILITAS:
- HIGH: ditemukan di idx.co.id atau OJK langsung, dengan tanggal dan harga spesifik
- MEDIUM: ditemukan di media terpercaya (Bisnis Indonesia, Kontan, CNBC Indonesia) dengan detail parsial
- LOW: disebutkan tanpa detail atau sumber tidak terverifikasi — JANGAN sertakan

RESPONS WAJIB DALAM FORMAT JSON MURNI (tidak ada teks lain sebelum atau sesudah):
{
  "transactions": [
    {
      "personName": "nama lengkap",
      "role": "jabatan lengkap",
      "transactionType": "BUY",
      "transactionDate": "YYYY-MM-DD",
      "filingDate": "YYYY-MM-DD",
      "shares": 100000,
      "pricePerShare": 9500,
      "totalValue": 950000000,
      "priceAtFiling": 9600,
      "source": "https://url-sumber.com/dokumen",
      "reliability": "HIGH"
    }
  ],
  "searchSummary": "Ringkasan singkat: apa yang ditemukan dan dari mana sumber utamanya"
}

Jika tidak ada transaksi ditemukan: { "transactions": [], "searchSummary": "penjelasan mengapa tidak ditemukan" }
JANGAN sertakan transaksi dengan reliability LOW.`;

// ── JSON extraction ──────────────────────────────────────────

function extractJSON(text: string): { transactions: any[]; searchSummary: string } | null {
  const clean = text.trim();
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed.transactions)) return parsed;
  } catch { /* fall through */ }

  const start = clean.indexOf('{');
  const end   = clean.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      if (Array.isArray(parsed.transactions)) return parsed;
    } catch { /* fall through */ }
  }

  return null;
}

// ── Validate and coerce a raw transaction object ─────────────

function coerceTransaction(raw: any, symbol: string): InsiderTransaction | null {
  if (!raw || typeof raw !== 'object') return null;

  const type = String(raw.transactionType ?? '').toUpperCase().trim();
  if (type !== 'BUY' && type !== 'SELL') return null;

  const personName = String(raw.personName ?? '').trim();
  if (!personName || personName.length < 2) return null;

  const txDate  = String(raw.transactionDate ?? '').trim();
  const filDate = String(raw.filingDate ?? '').trim();
  if (!txDate || !filDate) return null;

  // Require ISO date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txDate) || !/^\d{4}-\d{2}-\d{2}$/.test(filDate)) return null;

  const shares        = Number(raw.shares);
  const pricePerShare = Number(raw.pricePerShare);
  const totalValue    = Number(raw.totalValue);

  if (!isFinite(shares)        || shares <= 0)        return null;
  if (!isFinite(pricePerShare) || pricePerShare <= 0)  return null;
  if (!isFinite(totalValue)    || totalValue <= 0)     return null;

  const txMs  = new Date(txDate).getTime();
  const filMs = new Date(filDate).getTime();
  const filingDelayDays = isFinite(txMs) && isFinite(filMs)
    ? Math.max(0, Math.round((filMs - txMs) / 86_400_000))
    : 0;

  const rawPriceAtFiling = Number(raw.priceAtFiling);
  const priceAtFiling    = isFinite(rawPriceAtFiling) && rawPriceAtFiling > 0
    ? Math.round(rawPriceAtFiling)
    : Math.round(pricePerShare);

  const reliability: InsiderTransaction['reliability'] =
    raw.reliability === 'HIGH' ? 'HIGH' :
    raw.reliability === 'MEDIUM' ? 'MEDIUM' :
    'LOW';

  // Skip LOW reliability as instructed in prompt, but just in case
  if (reliability === 'LOW') return null;

  return {
    symbol:          symbol.toUpperCase(),
    personName,
    role:            String(raw.role ?? '').trim() || 'Direksi/Komisaris',
    transactionType: type as 'BUY' | 'SELL',
    transactionDate: txDate,
    filingDate:      filDate,
    filingDelayDays,
    shares:          Math.round(shares),
    pricePerShare:   Math.round(pricePerShare),
    totalValue:      Math.round(totalValue),
    priceAtFiling,
    source:          String(raw.source ?? '').trim() || 'Tidak ada URL',
    reliability,
  };
}

// ── Main research function ───────────────────────────────────

export async function researchInsiderTransactions(
  symbol:      string,
  companyName: string,
  client:      Anthropic,
  monthsBack:  number = 6
): Promise<InsiderTransaction[]> {
  const upperSymbol = symbol.toUpperCase();

  const cached = _cache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.transactions;
  }

  const year = new Date().getFullYear();

  try {
    const response = await Promise.race<Anthropic.Message>([
      client.messages.create({
        model:      'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [
          {
            type:     'web_search_20250305' as 'web_search_20250305',
            name:     'web_search',
            max_uses: 4,
          } as any,
        ],
        system: RESEARCH_SYSTEM_PROMPT,
        messages: [
          {
            role:    'user',
            content:
              `Cari transaksi insider untuk saham berikut:\n\n` +
              `KODE SAHAM: ${upperSymbol}\n` +
              `NAMA PERUSAHAAN: ${companyName}\n` +
              `TAHUN: ${year} (${monthsBack} bulan terakhir)\n\n` +
              `Gunakan 4 web_search untuk menemukan laporan kepemilikan saham direktur/komisaris. ` +
              `Prioritaskan sumber dari idx.co.id dan OJK resmi. ` +
              `Berikan respons dalam format JSON murni sesuai instruksi sistem.`,
          },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Insider research timeout')), RESEARCH_TIMEOUT_MS)
      ),
    ]);

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b)   => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    const parsed = extractJSON(rawText);
    if (!parsed) {
      console.warn(`[insiderResearch] JSON parse failed for ${upperSymbol}`);
      _cache.set(upperSymbol, { transactions: [], timestamp: Date.now() });
      return [];
    }

    const transactions: InsiderTransaction[] = (parsed.transactions ?? [])
      .map((raw: any) => coerceTransaction(raw, upperSymbol))
      .filter((t): t is InsiderTransaction => t !== null);

    console.log(
      `[insiderResearch] ${upperSymbol}: ${transactions.length} transactions found` +
      (parsed.searchSummary ? ` — ${parsed.searchSummary}` : '')
    );

    _cache.set(upperSymbol, { transactions, timestamp: Date.now() });
    return transactions;

  } catch (err: any) {
    console.error(`[insiderResearch] Error for ${upperSymbol}: ${err?.message ?? err}`);
    // Cache the empty result to prevent hammering the API on repeated failures
    _cache.set(upperSymbol, { transactions: [], timestamp: Date.now() });
    return [];
  }
}

// ── Cache accessors ──────────────────────────────────────────

export function getCachedInsiderTransactions(symbol: string): InsiderTransaction[] | null {
  const entry = _cache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _cache.delete(symbol.toUpperCase());
    return null;
  }
  return entry.transactions;
}

export function setInsiderTransactionsCache(symbol: string, transactions: InsiderTransaction[]): void {
  _cache.set(symbol.toUpperCase(), { transactions, timestamp: Date.now() });
}

export function getInsiderResearchCacheStats(): { total: number; bySymbol: Record<string, number> } {
  const bySymbol: Record<string, number> = {};
  for (const [sym, entry] of Array.from(_cache.entries())) {
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      bySymbol[sym] = entry.transactions.length;
    }
  }
  return { total: _cache.size, bySymbol };
}

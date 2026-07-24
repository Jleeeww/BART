/**
 * ============================================================
 * CHAT TOOLS v1.0
 * ============================================================
 * server/engine/chatTools.ts
 *
 * Tool belt for the "Chat with BART" agentic loop (routes/chat.ts).
 * Each tool wraps an existing engine and returns TWO payloads:
 *   result — compact JSON string for Claude (truncated ~4000 chars)
 *   widget — full-fidelity data for the client to render as a
 *            recharts chart / widget (streamed via SSE, persisted
 *            on the assistant message)
 *
 * Executors NEVER throw and NEVER trigger expensive research
 * pipelines — cached/DB reads only, plus the cheap IDX/Yahoo
 * fetchers that the rest of the app already uses.
 * ============================================================
 */

import type Anthropic from '@anthropic-ai/sdk';
import { storage } from '../storage';
import { computeStockReadiness } from './stockReadiness';
import { getBandarmology } from './stockbitBandarmology';
import { getIDXRatioForSymbol, fetchIDXIndexList, getIDXMovers, fetchIDXAnnouncements } from './idxData';
import { fetchOHLCV } from './ohlcvFetcher';
import { getImpactsForSymbol, getMarketAlerts } from './newsRouter';
import { getMacroFlowSnapshot } from './macroFlowFetcher';
import { getCachedMacroRegime } from './macroRegimeDetector';
import { getCachedInsiderScore } from './insiderScorer';
import { getCachedManagementResult } from './managementScorer';
import { computeValuation } from './valuationEngine';
import { retrieveContext, buildRetrievalQuery } from './ragEngine';

// ── Types ────────────────────────────────────────────────────

export interface ChatWidget {
  id:    string;   // unique per message, e.g. "price_chart-BBCA-1"
  type:  'price_chart' | 'bandar_flow' | 'layer_scores' | 'market_overview' | 'fundamentals' | 'themes';
  title: string;   // Bahasa Indonesia heading shown above the widget
  data:  Record<string, unknown>;
}

export interface ChatToolOutput {
  result:  string;             // compact JSON for the model
  isError: boolean;
  widget:  ChatWidget | null;  // full data for the UI (null = text-only tool)
}

// ── Helpers ──────────────────────────────────────────────────

const MAX_RESULT_CHARS = 4000;

/** IDR → miliar (billions), 2 decimals. */
const toB = (v: number | null | undefined): number | null =>
  v == null || !isFinite(v) ? null : Math.round((v / 1e9) * 100) / 100;

const round2 = (v: number | null | undefined): number | null =>
  v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;

const clip = (s: string | null | undefined, max: number): string | null =>
  s == null ? null : (s.length > max ? s.slice(0, max - 1) + '…' : s);

function ok(data: unknown): string {
  const s = JSON.stringify(data);
  return s.length > MAX_RESULT_CHARS ? s.slice(0, MAX_RESULT_CHARS) + '…"}' : s;
}

const notAvailable = (note: string): string => ok({ available: false, note });

let widgetSeq = 0;
function makeWidget(type: ChatWidget['type'], title: string, data: Record<string, unknown>): ChatWidget {
  widgetSeq = (widgetSeq + 1) % 1_000_000;
  return { id: `${type}-${Date.now()}-${widgetSeq}`, type, title, data };
}

// ── Activity labels (Bahasa, shown as SSE tool chips) ────────

export const TOOL_ACTIVITY_LABELS: Record<string, string> = {
  get_stock_analysis:     'menghitung skor 7-layer',
  get_bandarmology:       'mengambil data bandarmologi',
  get_fundamentals:       'mengambil rasio keuangan IDX',
  get_price_history:      'mengambil riwayat harga',
  get_stock_news:         'memeriksa berita emiten',
  get_market_overview:    'mengambil ringkasan pasar & makro',
  get_market_themes:      'membaca tema pasar terbaru',
  get_insider_management: 'memeriksa data insider & manajemen',
  search_stocks:          'mencari saham',
  get_knowledge_base:     'membuka basis pengetahuan BART',
  web_search:             'mencari di web',
};

// ── Tool definitions ─────────────────────────────────────────
// Descriptions are prescriptive about WHEN to call each tool —
// claude-opus-4-8 under-reaches for tools without explicit triggers.

export const CHAT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_stock_analysis',
    description:
      'Skor komposit 7-layer BART untuk satu saham (bandarmologi, berita, fundamental, manajemen, insider, valuasi, makro) plus keputusan engine. ' +
      'Panggil tool ini SETIAP KALI user bertanya tentang analisis, skor, kesiapan, atau kelayakan sebuah saham, atau menyebut satu ticker secara umum ("gimana BBCA?").',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Kode saham IDX, mis. BBCA' } },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_bandarmology',
    description:
      'Data bandarmologi terbaru satu saham: net flow asing/lokal/pemerintah, top buyer & seller broker, jumlah broker aktif. ' +
      'Panggil setiap kali user bertanya tentang bandarmologi, aliran dana asing/lokal, akumulasi/distribusi, atau broker summary suatu saham.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Kode saham IDX, mis. BBCA' } },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_fundamentals',
    description:
      'Rasio keuangan resmi IDX (PER, PBV, DER, ROE, ROA, NPM, EPS) plus label valuasi & kualitas vs benchmark sektor. ' +
      'Panggil saat user bertanya tentang fundamental, valuasi, murah/mahal, laba, atau membandingkan rasio antar saham (panggil sekali per saham).',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Kode saham IDX, mis. BBCA' } },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_price_history',
    description:
      'Riwayat harga harian (OHLCV) dari IDX/Yahoo: ringkasan tren, high/low periode, dan bar terakhir. ' +
      'Panggil saat user bertanya tentang pergerakan harga, tren, chart, support/resistance, atau performa harga suatu saham.',
    input_schema: {
      type: 'object',
      properties: {
        symbol:    { type: 'string',  description: 'Kode saham IDX, mis. BBCA' },
        rangeDays: { type: 'integer', description: 'Rentang hari kalender (5-120, default 30)' },
      },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_stock_news',
    description:
      'Dampak berita ter-analisis (24 jam terakhir) + pengumuman keterbukaan informasi IDX untuk satu saham. ' +
      'Panggil saat user bertanya tentang berita, sentimen, katalis, atau "ada apa dengan saham X".',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Kode saham IDX, mis. BBCA' } },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_market_overview',
    description:
      'Kondisi pasar hari ini: IHSG & indeks utama, top gainers/losers/teraktif, makro flow (USD/IDR, net flow asing, CDS), regime makro, dan alert berita penting. ' +
      'Panggil saat user bertanya tentang kondisi pasar/IHSG hari ini, market secara umum, makro, atau "lagi bagus nggak marketnya".',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_market_themes',
    description:
      'Hasil Thematic Scanner terbaru: tema pasar aktif (komoditas/moneter/geopolitik/regulasi/global) dan saham-saham yang ter-flag per tema. ' +
      'Panggil saat user bertanya tentang tema pasar, sektor yang lagi ramai, katalis tematik, atau "saham apa yang kena dampak X".',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_insider_management',
    description:
      'Skor insider (transaksi direksi/komisaris) dan skor kualitas manajemen (BOD) dari cache riset BART untuk satu saham. ' +
      'Panggil saat user bertanya tentang insider, direksi, manajemen, governance, atau red flag suatu emiten.',
    input_schema: {
      type: 'object',
      properties: { symbol: { type: 'string', description: 'Kode saham IDX, mis. BBCA' } },
      required: ['symbol'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_stocks',
    description:
      'Cari saham di database BART berdasarkan kode atau nama perusahaan. ' +
      'Panggil saat user menyebut nama perusahaan tanpa ticker yang jelas (mis. "bank jago", "telkom") sebelum memanggil tool lain.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Kata kunci: kode atau nama perusahaan' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_knowledge_base',
    description:
      'Basis pengetahuan historis BART (pgvector): pola pasar, outcome berita sebelumnya, profil manajemen, kausal makro. ' +
      'Panggil saat user bertanya tentang pola/kejadian historis, "biasanya kalau X terjadi apa", atau untuk konteks tambahan sebelum menyimpulkan.',
    input_schema: {
      type: 'object',
      properties: {
        query:  { type: 'string', description: 'Pertanyaan/topik yang dicari' },
        symbol: { type: 'string', description: 'Opsional: batasi ke satu kode saham' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

// ── Executors ────────────────────────────────────────────────

async function execStockAnalysis(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const stock = await storage.getStockBySymbol(sym);
  if (!stock) {
    return { result: notAvailable(`Saham ${sym} tidak ditemukan di database BART. Coba search_stocks dulu.`), isError: false, widget: null };
  }

  const r = computeStockReadiness({
    symbol:              sym,
    sector:              stock.sector ?? null,
    changePercent:       stock.changePercent ?? null,
    flowBias:            stock.flowBias ?? null,
    flowIntensity:       stock.flowIntensity ?? null,
    flowReliability:     stock.flowReliability ?? null,
    brokerData:          stock.brokerData ?? null,
    foreignActivityData: stock.foreignActivityData ?? null,
    stockCharacter:      stock.stockCharacter ?? null,
    insiderData:         stock.insiderData ?? null,
    growth:              stock.growth ?? null,
    peRatio:             stock.peRatio ?? null,
    dividendYield:       stock.dividendYield ?? null,
    roe:                 stock.roe ?? null,
    netMargin:           stock.netMargin ?? null,
    marketCap:           stock.marketCap ?? null,
    avg20dValue:         (stock as any).avg20dValue ?? null,
  });

  const layerRows = [
    { key: 'bandarmology',     label: 'Bandarmologi', ...r.layers.bandarmology },
    { key: 'newsIntelligence', label: 'Berita',       ...r.layers.newsIntelligence },
    { key: 'fundamental',      label: 'Fundamental',  ...r.layers.fundamental },
    { key: 'management',       label: 'Manajemen',    ...r.layers.management },
    { key: 'insiderActivity',  label: 'Insider',      ...r.layers.insiderActivity },
    { key: 'valuation',        label: 'Valuasi',      ...r.layers.valuation },
    { key: 'macroSector',      label: 'Makro/Sektor', ...r.layers.macroSector },
  ];

  const result = ok({
    symbol: sym,
    name: stock.name,
    price: Number(stock.price),
    changePercent: Number(stock.changePercent),
    sector: stock.sector,
    compositeScore: r.compositeScore,
    layers: Object.fromEntries(layerRows.map((l) => [l.key, l.score])),
    hardOverride: r.hardOverride,
    macroHardCap: r.macroHardCap,
    activeFlags: r.activeFlags,
    isGorengan: r.isGorengan,
    macroRegime: r.macroRegime.regime,
    decision: {
      actionState:    r.actionState,
      bucket:         r.homepageBucket,
      readiness:      r.decision.readiness,
      shortSummary:   clip(r.decision.shortSummary, 300),
      whyAction:      clip(r.decision.whyAction.join(' '), 300),
      mainRisk:       clip(r.decision.mainRisk, 300),
      failureTrigger: clip(r.decision.failureTrigger, 300),
    },
  });

  const widget = makeWidget('layer_scores', `Analisis 7-Layer — ${sym}`, {
    symbol: sym,
    name: stock.name,
    price: Number(stock.price),
    changePercent: Number(stock.changePercent),
    compositeScore: r.compositeScore,
    actionState: r.actionState,
    actionGuidance: r.actionGuidance,
    actionColor: r.actionColor,
    hardOverride: r.hardOverride,
    isGorengan: r.isGorengan,
    layers: layerRows,
  });

  return { result, isError: false, widget };
}

async function execBandarmology(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const [bandar, stock] = await Promise.all([getBandarmology(sym), storage.getStockBySymbol(sym)]);
  if (!bandar) {
    return {
      result: notAvailable(`Data bandarmologi ${sym} belum tersedia (belum ada sweep Stockbit hari ini atau token tidak aktif).`),
      isError: false,
      widget: null,
    };
  }

  const legs = (arr: typeof bandar.topBuyers, n: number) =>
    arr.slice(0, n).map((l) => ({ broker: l.broker, type: l.type, valueB: toB(l.value) }));

  const result = ok({
    symbol: sym,
    date: bandar.date,
    foreignNetB: toB(bandar.foreignNet),
    localNetB:   toB(bandar.localNet),
    govNetB:     toB(bandar.govNet),
    netValueB:   toB(bandar.netValue),
    topBuyers:  legs(bandar.topBuyers, 5),
    topSellers: legs(bandar.topSellers, 5),
    brokerCount: bandar.brokerCount,
    flowBias:        stock?.flowBias ?? null,
    flowIntensity:   stock?.flowIntensity ?? null,
    flowReliability: stock?.flowReliability ?? null,
    unit: 'miliar IDR',
  });

  const widget = makeWidget('bandar_flow', `Bandarmologi — ${sym} (${bandar.date})`, {
    symbol: sym,
    date: bandar.date,
    foreignNetB: toB(bandar.foreignNet),
    localNetB:   toB(bandar.localNet),
    govNetB:     toB(bandar.govNet),
    netValueB:   toB(bandar.netValue),
    brokerCount: bandar.brokerCount,
    flowBias: stock?.flowBias ?? null,
    topBuyers:  legs(bandar.topBuyers, 8),
    topSellers: legs(bandar.topSellers, 8),
  });

  return { result, isError: false, widget };
}

async function execFundamentals(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const [ratio, stock] = await Promise.all([getIDXRatioForSymbol(sym), storage.getStockBySymbol(sym)]);
  if (!ratio && !stock) {
    return { result: notAvailable(`Rasio keuangan ${sym} tidak ditemukan.`), isError: false, widget: null };
  }

  const sector = ratio?.sector ?? stock?.sector ?? null;
  const val = computeValuation({
    peRatio:       ratio?.per ?? (stock ? Number(stock.peRatio) : null),
    dividendYield: stock ? Number(stock.dividendYield) : null,
    roe:           ratio?.roe ?? (stock ? Number(stock.roe) : null),
    netMargin:     ratio?.npm ?? (stock ? Number(stock.netMargin) : null),
    sector,
  });

  // NOTE: sales/netProfit from the IDX ratio feed have inconsistent units —
  // deliberately excluded so the model and widget never show a wrong magnitude.
  const ratios = {
    per: round2(ratio?.per), pbv: round2(ratio?.pbv), der: round2(ratio?.der),
    roe: round2(ratio?.roe), roa: round2(ratio?.roa), npm: round2(ratio?.npm),
    eps: round2(ratio?.eps),
    fsDate: ratio?.fsDate ?? null,
  };

  const result = ok({
    symbol: sym,
    name: ratio?.name ?? stock?.name ?? sym,
    sector,
    ...ratios,
    valuationLabel: val.valuation.label,
    valuationInterpretation: clip(val.valuation.interpretation, 250),
    qualityLabel: val.quality.label,
    qualityInterpretation: clip(val.quality.interpretation, 250),
    sectorBenchmark: { avgPE: val.valuation.sectorBenchmark.avgPE ?? null, relativePE: round2(val.valuation.relativePE) },
  });

  const widget = makeWidget('fundamentals', `Fundamental — ${sym}`, {
    symbol: sym,
    name: ratio?.name ?? stock?.name ?? sym,
    sector,
    ratios,
    valuationLabel: val.valuation.label,
    valuationScore: val.valuation.score,
    qualityLabel: val.quality.label,
    qualityScore: val.quality.score,
    relativePE: round2(val.valuation.relativePE),
  });

  return { result, isError: false, widget };
}

async function execPriceHistory(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const range = Math.max(5, Math.min(120, Number(input.rangeDays) || 30));
  const { bars, source } = await fetchOHLCV(sym, range);
  if (bars.length === 0) {
    return { result: notAvailable(`Riwayat harga ${sym} tidak tersedia dari IDX maupun Yahoo.`), isError: false, widget: null };
  }

  const first = bars[0], last = bars[bars.length - 1];
  const highs = bars.map((b) => b.high), lows = bars.map((b) => b.low);
  const vols = bars.map((b) => b.volume).filter((v): v is number => v != null);
  const changePct = first.close > 0 ? round2(((last.close - first.close) / first.close) * 100) : null;

  const result = ok({
    symbol: sym,
    source,
    rangeDays: range,
    barCount: bars.length,
    firstDate: first.time,
    lastDate: last.time,
    latestClose: last.close,
    periodHigh: Math.max(...highs),
    periodLow: Math.min(...lows),
    changePct,
    avgVolume: vols.length ? Math.round(vols.reduce((s, v) => s + v, 0) / vols.length) : null,
    recentBars: bars.slice(-10).map((b) => ({ time: b.time, close: b.close, volume: b.volume })),
  });

  const widget = makeWidget('price_chart', `Harga — ${sym} (${bars.length} sesi, ${source})`, {
    symbol: sym,
    source,
    latestClose: last.close,
    changePct,
    bars: bars.map((b) => ({ time: b.time, close: b.close, volume: b.volume })),
  });

  return { result, isError: false, widget };
}

async function execStockNews(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const stock = await storage.getStockBySymbol(sym);
  const impacts = getImpactsForSymbol(sym, stock?.sector ?? '').slice(0, 5).map((i) => ({
    eventType: i.eventType,
    severity: i.eventSeverity,
    direction: i.direction,
    strength: i.strength,
    mechanism: clip(i.mechanism, 200),
    traderImplication: clip(i.traderImplication, 200),
    matchType: i.matchType,
    analyzedAt: i.analyzedAt,
  }));
  const announcements = (await fetchIDXAnnouncements(sym, 5)).map((a) => ({ title: clip(a.title, 150), date: a.date }));

  if (impacts.length === 0 && announcements.length === 0) {
    return { result: notAvailable(`Belum ada berita ter-analisis atau pengumuman IDX untuk ${sym} dalam cache saat ini.`), isError: false, widget: null };
  }
  return { result: ok({ symbol: sym, impacts, announcements }), isError: false, widget: null };
}

const KEY_INDICES = ['COMPOSITE', 'LQ45', 'IDX30', 'IDX80', 'IDXHIDIV20', 'JII'];

async function execMarketOverview(): Promise<ChatToolOutput> {
  const [indices, movers, macro] = await Promise.all([
    fetchIDXIndexList(),
    getIDXMovers(5),
    getMacroFlowSnapshot().catch(() => null),
  ]);
  const regime = getCachedMacroRegime();
  const alerts = getMarketAlerts().slice(0, 3);

  const keyIdx = KEY_INDICES
    .map((code) => indices.find((i) => i.code === code))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => ({ code: i.code, value: i.value, percent: i.percent }));
  const idxRows = keyIdx.length > 0 ? keyIdx : indices.slice(0, 6).map((i) => ({ code: i.code, value: i.value, percent: i.percent }));

  const mv = (arr: typeof movers.gainers) =>
    arr.map((m) => ({ code: m.code, changePercent: m.changePercent, valueB: toB(m.value) }));

  const macroCompact = macro ? {
    usdIdr: macro.usdIdr,
    ihsgForeignNetFlowB: toB(macro.ihsgForeignNetFlow),
    indo5yCDS: macro.indo5yCDS,
    dataQuality: macro.dataQuality,
  } : null;

  const result = ok({
    indices: idxRows,
    gainers: mv(movers.gainers),
    losers: mv(movers.losers),
    mostActive: mv(movers.mostActive),
    macro: macroCompact,
    regime: { regime: regime.regime, multiplier: regime.multiplier, note: clip(regime.note, 200) },
    alerts: alerts.map((a) => ({ eventType: a.eventType, severity: a.eventSeverity, traderImplication: clip(a.traderImplication, 200) })),
  });

  const widget = makeWidget('market_overview', 'Ringkasan Pasar Hari Ini', {
    indices: idxRows,
    gainers: mv(movers.gainers),
    losers: mv(movers.losers),
    mostActive: mv(movers.mostActive),
    macro: macroCompact,
    regime: { regime: regime.regime, multiplier: regime.multiplier },
  });

  return { result, isError: false, widget };
}

async function execMarketThemes(): Promise<ChatToolOutput> {
  const scan = await storage.getLatestThematicScan();
  if (!scan) {
    return { result: notAvailable('Belum ada pemindaian tema pasar.'), isError: false, widget: null };
  }
  const { db } = await import('../db');
  const { thematicStockFlags } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');
  const flags = await db.select().from(thematicStockFlags).where(eq(thematicStockFlags.scanId, scan.id));

  const themes = (Array.isArray(scan.themes) ? (scan.themes as any[]) : []).map((t) => ({
    title: t.title ?? t.id ?? '',
    category: t.category ?? null,
    summary: clip(String(t.summary ?? ''), 200),
    confidence: t.confidence ?? null,
  }));
  const flagRows = flags.slice(0, 15).map((f) => ({
    symbol: f.symbol,
    theme: f.theme,
    direction: f.direction,
    rationale: clip(f.rationale, 200),
    confidence: f.confidence,
  }));

  const result = ok({
    scanAt: scan.scanAt,
    status: scan.status,
    narrative: clip(scan.narrative, 400),
    themes,
    flags: flagRows,
  });

  const widget = makeWidget('themes', 'Tema Pasar Terbaru', {
    scanAt: scan.scanAt,
    narrative: clip(scan.narrative, 400),
    themes,
    flags: flagRows,
  });

  return { result, isError: false, widget };
}

async function execInsiderManagement(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const sym = String(input.symbol ?? '').toUpperCase().trim();
  const insider = getCachedInsiderScore(sym);
  const mgmt = getCachedManagementResult(sym);

  const result = ok({
    symbol: sym,
    insider: insider ? {
      signal: insider.signal,
      score: insider.score,
      buyCount: insider.insiderBuyCount,
      sellCount: insider.insiderSellCount,
      netValueB: toB(insider.netInsiderValue),
      clusterBuySignal: insider.clusterBuySignal,
      note: clip(insider.note, 250),
      computedAt: insider.computedAt,
    } : { available: false, note: 'Belum ada riset insider di cache untuk saham ini.' },
    management: mgmt ? {
      compositeScore: mgmt.compositeScore,
      qualityLabel: mgmt.qualityLabel,
      hasCriticalRedFlag: mgmt.hasCriticalRedFlag,
      criticalRedFlagReason: clip(mgmt.criticalRedFlagReason, 250),
      reliability: mgmt.reliability,
      researchedAt: mgmt.researchedAt,
    } : { available: false, note: 'Belum ada riset manajemen di cache untuk saham ini.' },
  });

  return { result, isError: false, widget: null };
}

async function execSearchStocks(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const q = String(input.query ?? '').toLowerCase().trim();
  if (!q) return { result: notAvailable('Query kosong.'), isError: false, widget: null };
  const all = await storage.getAllStocks();
  const matches = all
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: Number(s.price),
      changePercent: Number(s.changePercent),
      sector: s.sector,
    }));
  if (matches.length === 0) {
    return { result: notAvailable(`Tidak ada saham yang cocok dengan "${q}" di database BART.`), isError: false, widget: null };
  }
  return { result: ok({ matches }), isError: false, widget: null };
}

async function execKnowledgeBase(input: Record<string, unknown>): Promise<ChatToolOutput> {
  const query = String(input.query ?? '').trim();
  const symbol = input.symbol ? String(input.symbol).toUpperCase().trim() : null;
  const docs = await retrieveContext(buildRetrievalQuery(symbol ?? '', query), symbol, 4);
  if (docs.length === 0) {
    return { result: notAvailable('Tidak ada dokumen relevan di basis pengetahuan (atau embeddings belum aktif).'), isError: false, widget: null };
  }
  return {
    result: ok({
      docs: docs.map((d) => ({
        type: d.type,
        symbol: d.symbol,
        content: clip(d.content, 500),
        similarity: round2(d.similarity),
      })),
    }),
    isError: false,
    widget: null,
  };
}

// ── Dispatcher ───────────────────────────────────────────────

const EXECUTORS: Record<string, (input: Record<string, unknown>) => Promise<ChatToolOutput>> = {
  get_stock_analysis:     execStockAnalysis,
  get_bandarmology:       execBandarmology,
  get_fundamentals:       execFundamentals,
  get_price_history:      execPriceHistory,
  get_stock_news:         execStockNews,
  get_market_overview:    execMarketOverview,
  get_market_themes:      execMarketThemes,
  get_insider_management: execInsiderManagement,
  search_stocks:          execSearchStocks,
  get_knowledge_base:     execKnowledgeBase,
};

/** Execute one chat tool. Never throws — errors come back as {result, isError:true}. */
export async function executeChatTool(name: string, input: Record<string, unknown>): Promise<ChatToolOutput> {
  const exec = EXECUTORS[name];
  if (!exec) {
    return { result: JSON.stringify({ error: `Tool tidak dikenal: ${name}` }), isError: true, widget: null };
  }
  try {
    return await exec(input ?? {});
  } catch (err) {
    console.error(`[chatTools] ${name} error:`, err);
    return {
      result: JSON.stringify({ error: `Tool ${name} gagal: ${err instanceof Error ? err.message : String(err)}` }),
      isError: true,
      widget: null,
    };
  }
}

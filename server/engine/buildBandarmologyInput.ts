/**
 * ============================================================
 * BANDARMOLOGY INPUT ADAPTER v2.0
 * ============================================================
 * server/engine/buildBandarmologyInput.ts
 *
 * Converts raw database stock records into typed BandarmologyInput.
 *
 * DESIGN RULES:
 *   - No crashes: every field has a safe fallback
 *   - No silent corruption: all parsing is explicit
 *   - Missing fields are allowed and produce safe defaults
 *   - JSON parsing is always in try/catch
 *   - IDR parsing delegates to parseIDR() from the core engine
 *
 * CRITICAL v2.0 CONSTRAINT:
 *   m6ScoreHistory must be loaded from bandarmology_history storage
 *   via getM6History(symbol, 5) BEFORE calling computeBandarmologyV2().
 *   This field is NOT derived from the raw stock record.
 *   Pass it explicitly as the second argument or via rawStock._m6ScoreHistory.
 * ============================================================
 */

import {
  BandarmologyInput,
  BrokerRecord,
  FlowSummary,
  FlowSignals,
  PriceData,
  VolumeData,
  CalendarFlags,
  parseIDR,
} from "./bandarmologyCore";

// ============================================================
// RAW STOCK RECORD — what the database provides
// All fields are optional/nullable to match real schema variance.
// ============================================================

export interface RawStockRecord {
  // Core identity
  symbol?: string | null;
  date?: string | null;

  // JSON blob fields
  brokerData?: string | object | null;
  foreignActivityData?: string | object | null;

  // Price fields
  price?: string | number | null;
  close?: string | number | null;
  open?: string | number | null;
  high?: string | number | null;
  low?: string | number | null;
  change?: string | number | null;
  changePercent?: string | number | null;
  prevClose?: string | number | null;

  // Average price fields
  avgBuyPrice?: string | number | null;
  avgSellPrice?: string | number | null;

  // Volume/value fields
  todayVolume?: string | number | null;
  avg20dVolume?: string | number | null;
  todayValue?: string | number | null;
  avg20dValue?: string | number | null;

  // Categorical flow signals
  flowBias?: string | null;
  flowIntensity?: string | null;
  flowReliability?: string | null;

  // Pre-computed history arrays (optional enrichment)
  netFlowHistory?: (number | null | undefined)[] | null;
  priceHistory?: (number | null | undefined)[] | null;

  // v2.0: M6 score history — loaded from bandarmology_history storage
  // NEVER today's M6 score. Must be prior sessions, oldest first.
  _m6ScoreHistory?: number[] | null;

  // Calendar flags — optional, defaults all false
  calendarFlags?: Partial<CalendarFlags> | null;
}

// ============================================================
// SAFE NUMBER PARSERS
// ============================================================

/**
 * Parse any price/number field safely. Returns 0 on any failure.
 */
function safeNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isFinite(val) && !isNaN(val) ? val : 0;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

/**
 * Parse a percentage string. "12.4%" → 12.4
 */
function safePercent(val: string | null | undefined): number {
  if (!val) return 0;
  return safeNum(String(val).replace("%", ""));
}

// ============================================================
// JSON BLOB PARSERS
// ============================================================

/**
 * Safely parse a JSON field that may already be an object.
 */
function safeParseJSON(raw: string | object | null | undefined, fallback: unknown): unknown {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object") return raw; // already parsed by ORM
  try {
    const result = JSON.parse(raw as string);
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Parse brokerData JSON into BrokerRecord[].
 * Handles various field name conventions from different data sources.
 */
function parseBrokerData(raw: string | object | null | undefined): BrokerRecord[] {
  const parsed = safeParseJSON(raw, []);
  if (!Array.isArray(parsed)) return [];

  return (parsed as unknown[])
    .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
    .map((b) => ({
      code: String(b.code ?? b.brokerCode ?? b.broker ?? ""),
      netBuyRaw:     String(b.netBuy   ?? b.netBuyRaw   ?? b.buy  ?? "") || null,
      netSellRaw:    String(b.netSell  ?? b.netSellRaw  ?? b.sell ?? "") || null,
      volumePercent: String(b.volumePercent ?? b.volPct  ?? b.pct  ?? "") || null,
      avgBuyPrice:   String(b.avgBuy   ?? b.avgBuyPrice ?? b.buyPrice  ?? "") || null,
      avgSellPrice:  String(b.avgSell  ?? b.avgSellPrice ?? b.sellPrice ?? "") || null,
    }))
    .filter((b) => b.code.length > 0);
}

/**
 * Parse foreignActivityData JSON into FlowSummary.
 * Handles multiple field name conventions.
 */
function parseForeignActivity(
  raw: string | object | null | undefined
): FlowSummary {
  const d = safeParseJSON(raw, {}) as Record<string, unknown>;

  // netForeignFlow: try multiple keys
  const netForeignFlow =
    parseIDR(d.netForeignFlow as string) ||
    parseIDR(d.foreignNet as string)     ||
    parseIDR(d.netForeign as string)     ||
    (parseIDR(d.foreignBuy as string) - parseIDR(d.foreignSell as string));

  const netDomesticFlow =
    parseIDR(d.netDomesticFlow as string) ||
    parseIDR(d.domesticNet as string)     ||
    parseIDR(d.netDomestic as string)     ||
    (parseIDR(d.domesticBuy as string) - parseIDR(d.domesticSell as string));

  return {
    netForeignFlow,
    netDomesticFlow,
    foreignBuy:    parseIDR(d.foreignBuy as string),
    foreignSell:   parseIDR(d.foreignSell as string),
    domesticBuy:   parseIDR(d.domesticBuy as string),
    domesticSell:  parseIDR(d.domesticSell as string),
  };
}

// ============================================================
// FLOW SIGNAL MAPPERS
// Normalize string values from DB into typed union values.
// Unknown values map to safe defaults.
// ============================================================

const FLOW_BIAS_MAP: Record<string, FlowSignals["flowBias"]> = {
  "akumulasi": "Akumulasi",
  "distribusi": "Distribusi",
  "netral": "Netral",
};

const FLOW_INTENSITY_MAP: Record<string, FlowSignals["flowIntensity"]> = {
  "akumulasi besar":   "Akumulasi Besar",
  "akumulasi sedang":  "Akumulasi Sedang",
  "akumulasi ringan":  "Akumulasi Ringan",
  "netral":            "Netral",
  "distribusi ringan": "Distribusi Ringan",
  "distribusi sedang": "Distribusi Sedang",
  "distribusi besar":  "Distribusi Besar",
};

const FLOW_RELIABILITY_MAP: Record<string, FlowSignals["flowReliability"]> = {
  "tinggi": "Tinggi",
  "sedang": "Sedang",
  "rendah": "Rendah",
};

function mapFlowSignals(raw: RawStockRecord): FlowSignals {
  const bias = (raw.flowBias ?? "").toLowerCase().trim();
  const intensity = (raw.flowIntensity ?? "").toLowerCase().trim();
  const reliability = (raw.flowReliability ?? "").toLowerCase().trim();

  return {
    flowBias: FLOW_BIAS_MAP[bias] ?? "Netral",
    flowIntensity: FLOW_INTENSITY_MAP[intensity] ?? "Tidak Ada Data",
    flowReliability: FLOW_RELIABILITY_MAP[reliability] ?? "Sedang",
  };
}

// ============================================================
// HISTORY CLEANERS
// ============================================================

/**
 * Clean a number array, removing NaN/null/Infinity.
 * Returns null if result is empty.
 */
function cleanNumberArray(
  arr: (number | null | undefined)[] | null | undefined
): number[] | null {
  if (!arr || !Array.isArray(arr)) return null;
  const clean = arr.filter(
    (v): v is number => v !== null && v !== undefined && !isNaN(v) && isFinite(v)
  );
  return clean.length > 0 ? clean : null;
}

// ============================================================
// MAIN ADAPTER FUNCTION
// ============================================================

/**
 * Convert a raw database stock record into a typed BandarmologyInput.
 *
 * @param rawStock  - raw record from database
 * @param m6History - prior-session M6 scores from bandarmology_history.
 *                    Load via getM6History(symbol, 5) BEFORE calling this.
 *                    Pass null if unavailable — M16 will be skipped safely.
 *
 * @returns BandarmologyInput ready for computeBandarmologyV2()
 */
export function buildBandarmologyInput(
  rawStock: RawStockRecord,
  m6History?: number[] | null
): BandarmologyInput {

  // ── Broker data ─────────────────────────────────────────────
  const brokers = parseBrokerData(rawStock.brokerData);

  // ── Foreign / domestic flow ──────────────────────────────────
  const flow = parseForeignActivity(rawStock.foreignActivityData);

  // ── Price ────────────────────────────────────────────────────
  // close: try 'close' first, fall back to 'price'
  const close    = safeNum(rawStock.close ?? rawStock.price);
  const open     = safeNum(rawStock.open  ?? close);
  const high     = safeNum(rawStock.high  ?? close);
  const low      = safeNum(rawStock.low   ?? close);

  // prevClose: explicit field takes priority, else derive from change
  let prevClose = safeNum(rawStock.prevClose);
  if (prevClose === 0 && close > 0) {
    const change = safeNum(rawStock.change);
    // Only derive if change looks plausible (not 0 which is ambiguous)
    if (change !== 0) prevClose = close - change;
    else prevClose = close; // fallback: assume no change
  }

  const avgBuyPrice  = parseIDR(rawStock.avgBuyPrice);
  const avgSellPrice = parseIDR(rawStock.avgSellPrice);

  const price: PriceData = { open, high, low, close, prevClose, avgBuyPrice, avgSellPrice };

  // ── Volume / value ────────────────────────────────────────────
  const todayVolume  = safeNum(rawStock.todayVolume);
  const avg20dVolume = safeNum(rawStock.avg20dVolume);
  const todayValue   = parseIDR(rawStock.todayValue)  || safeNum(rawStock.todayValue);
  const avg20dValue  = parseIDR(rawStock.avg20dValue) || safeNum(rawStock.avg20dValue);

  const volume: VolumeData = { todayVolume, avg20dVolume, todayValue, avg20dValue };

  // ── Flow signals ─────────────────────────────────────────────
  const signals = mapFlowSignals(rawStock);

  // ── History arrays ────────────────────────────────────────────
  const netFlowHistory = cleanNumberArray(rawStock.netFlowHistory);
  const priceHistory   = cleanNumberArray(rawStock.priceHistory);

  // ── M6 score history (v2.0 — from storage, not derived here) ──
  // Priority: explicit m6History argument > rawStock._m6ScoreHistory > null
  const m6ScoreHistory =
    m6History !== undefined ? cleanNumberArray(m6History)
    : cleanNumberArray(rawStock._m6ScoreHistory);

  // ── Calendar flags ────────────────────────────────────────────
  const calendarFlags: CalendarFlags = {
    isExDividend:           Boolean(rawStock.calendarFlags?.isExDividend),
    isRebalanceDay:         Boolean(rawStock.calendarFlags?.isRebalanceDay),
    isRightsIssuePeriod:    Boolean(rawStock.calendarFlags?.isRightsIssuePeriod),
    isPostSuspension:       Boolean(rawStock.calendarFlags?.isPostSuspension),
    isWindowDressingPeriod: Boolean(rawStock.calendarFlags?.isWindowDressingPeriod),
  };

  return {
    brokers,
    flow,
    price,
    volume,
    signals,
    netFlowHistory,
    priceHistory,
    m6ScoreHistory,
    calendarFlags,
  };
}

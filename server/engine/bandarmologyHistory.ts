/**
 * ============================================================
 * BANDARMOLOGY HISTORY STORAGE LAYER v2.0
 * ============================================================
 * server/engine/bandarmologyHistory.ts
 *
 * Persistent storage for M6 scores and session metadata.
 * Used to feed M16 RegimeStability with prior-session M6 history.
 *
 * TABLE: bandarmology_history
 *   symbol     TEXT        — stock symbol e.g. "BBRI"
 *   date       TEXT        — ISO date string e.g. "2025-01-15"
 *   m6Score    REAL        — M6 score for this session (null if suppressed)
 *   netFlow    REAL        — net total flow in IDR for this session
 *   closePrice REAL        — closing price for this session
 *
 * KEY INVARIANT:
 *   getM6History() returns scores ordered OLDEST → NEWEST.
 *   This is mandatory for M12 and M16 to work correctly.
 *   Reversed order inverts M12 recency weights and breaks M16 regime detection.
 *
 * DESIGN:
 *   - Implemented against a generic Storage interface
 *   - Default implementation uses SQLite via drizzle/better-sqlite3
 *   - Falls back to in-memory Map if database is unavailable
 *   - Safe on empty: returns [] not null/undefined
 *   - All reads/writes wrapped in try/catch
 *
 * TO ADAPT:
 *   Replace the SQLiteStorage class with your actual DB adapter.
 *   The interface contract (getM6History, saveBandarmologyHistory) is stable.
 * ============================================================
 */

import type { BandarmologyV2Result } from './bandarmologyCore';
export type { BandarmologyV2Result } from './bandarmologyCore';

// ============================================================
// TYPES
// ============================================================

export interface BandarmologyHistoryRecord {
  symbol:     string;
  date:       string;       // ISO date: "YYYY-MM-DD"
  m6Score:    number | null; // null if model was suppressed that session
  netFlow:    number | null; // net total flow (IDR)
  closePrice: number | null; // closing price
}

// ============================================================
// STORAGE INTERFACE
// ============================================================

export interface HistoryStorage {
  /**
   * Retrieve up to n prior sessions for a symbol.
   * Returns records ordered OLDEST → NEWEST.
   * Returns [] if no history exists (safe on empty).
   * n capped at MAX_HISTORY_RECORDS.
   */
  getRecords(symbol: string, n: number): Promise<BandarmologyHistoryRecord[]>;

  /**
   * Insert or replace a session record.
   * Upsert on (symbol, date) — idempotent.
   */
  saveRecord(record: BandarmologyHistoryRecord): Promise<void>;
}

const MAX_HISTORY_RECORDS = 20;

// ============================================================
// IN-MEMORY FALLBACK STORAGE
// Used when no database is configured, or for testing.
// Data does NOT persist across process restarts.
// ============================================================

class InMemoryStorage implements HistoryStorage {
  // key: "SYMBOL::DATE" → record
  private store = new Map<string, BandarmologyHistoryRecord>();

  private key(symbol: string, date: string): string {
    return `${symbol.toUpperCase()}::${date}`;
  }

  async getRecords(symbol: string, n: number): Promise<BandarmologyHistoryRecord[]> {
    const cap = Math.min(n, MAX_HISTORY_RECORDS);
    const sym = symbol.toUpperCase();
    const records: BandarmologyHistoryRecord[] = [];

    for (const [k, v] of Array.from(this.store)) {
      if (k.startsWith(`${sym}::`)) records.push(v);
    }

    // Sort oldest → newest (ascending date)
    records.sort((a, b) => a.date.localeCompare(b.date));

    // Return last n (most recent n, still oldest→newest)
    return records.slice(-cap);
  }

  async saveRecord(record: BandarmologyHistoryRecord): Promise<void> {
    this.store.set(this.key(record.symbol, record.date), { ...record });
  }
}

// ============================================================
// SQLITE STORAGE (replace with your ORM/driver)
// Uncomment and adapt if using drizzle-orm + better-sqlite3.
// ============================================================

// import Database from "better-sqlite3";
// import path from "path";
//
// class SQLiteStorage implements HistoryStorage {
//   private db: Database.Database;
//
//   constructor(dbPath: string) {
//     this.db = new Database(dbPath);
//     this.db.exec(`
//       CREATE TABLE IF NOT EXISTS bandarmology_history (
//         symbol     TEXT    NOT NULL,
//         date       TEXT    NOT NULL,
//         m6Score    REAL,
//         netFlow    REAL,
//         closePrice REAL,
//         PRIMARY KEY (symbol, date)
//       );
//       CREATE INDEX IF NOT EXISTS idx_bh_symbol_date
//         ON bandarmology_history (symbol, date);
//     `);
//   }
//
//   async getRecords(symbol: string, n: number): Promise<BandarmologyHistoryRecord[]> {
//     const cap = Math.min(n, MAX_HISTORY_RECORDS);
//     try {
//       const rows = this.db
//         .prepare(`
//           SELECT symbol, date, m6Score, netFlow, closePrice
//           FROM bandarmology_history
//           WHERE symbol = ?
//           ORDER BY date ASC        -- OLDEST FIRST: mandatory for M12/M16
//           LIMIT ?
//         `)
//         .all(symbol.toUpperCase(), cap) as BandarmologyHistoryRecord[];
//       return rows;
//     } catch (err) {
//       console.error("[bandarmologyHistory] getRecords error:", err);
//       return [];
//     }
//   }
//
//   async saveRecord(record: BandarmologyHistoryRecord): Promise<void> {
//     try {
//       this.db
//         .prepare(`
//           INSERT INTO bandarmology_history (symbol, date, m6Score, netFlow, closePrice)
//           VALUES (@symbol, @date, @m6Score, @netFlow, @closePrice)
//           ON CONFLICT (symbol, date) DO UPDATE SET
//             m6Score    = excluded.m6Score,
//             netFlow    = excluded.netFlow,
//             closePrice = excluded.closePrice
//         `)
//         .run({
//           symbol:     record.symbol.toUpperCase(),
//           date:       record.date,
//           m6Score:    record.m6Score   ?? null,
//           netFlow:    record.netFlow   ?? null,
//           closePrice: record.closePrice ?? null,
//         });
//     } catch (err) {
//       console.error("[bandarmologyHistory] saveRecord error:", err);
//       // Do not re-throw — saving history is not mission-critical.
//     }
//   }
// }

// ============================================================
// STORAGE SINGLETON
// Swap implementation here to use a real database.
// ============================================================

let _storage: HistoryStorage | null = null;

function getStorage(): HistoryStorage {
  if (!_storage) {
    // Production: replace InMemoryStorage with SQLiteStorage or drizzle adapter.
    // Example: _storage = new SQLiteStorage(path.join(process.cwd(), "bandarmology.db"));
    _storage = new InMemoryStorage();
  }
  return _storage;
}

/**
 * Override the storage implementation (for testing or dependency injection).
 * Call this before any getM6History / saveBandarmologyHistory calls.
 */
export function setHistoryStorage(storage: HistoryStorage): void {
  _storage = storage;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Retrieve up to n prior M6 scores for a symbol.
 *
 * Returns an array ordered OLDEST → NEWEST.
 * This ordering is MANDATORY for M12 recency weights and M16 regime detection.
 *
 * Returns [] (empty array) if:
 *   - no history exists yet (first session)
 *   - database error
 *   - symbol not found
 * This is safe: M16 returns null when history is empty (no regime modifier).
 *
 * @param symbol  - stock symbol e.g. "BBRI"
 * @param n       - number of sessions to retrieve (1–20, capped at 20)
 * @returns number[] ordered oldest → newest, filtered for non-null scores
 */
export async function getM6History(
  symbol: string,
  n: number = 5
): Promise<number[]> {
  if (!symbol || typeof symbol !== "string") return [];
  const cap = Math.max(1, Math.min(n, MAX_HISTORY_RECORDS));

  try {
    const records = await getStorage().getRecords(symbol, cap);

    // Extract non-null M6 scores in oldest→newest order
    const scores = records
      .filter((r) => r.m6Score !== null && r.m6Score !== undefined)
      .map((r) => r.m6Score as number)
      .filter((s) => !isNaN(s) && isFinite(s));

    return scores;
  } catch (err) {
    console.error(`[bandarmologyHistory] getM6History error for ${symbol}:`, err);
    return [];
  }
}

/**
 * Save a Bandarmology session result to history.
 *
 * Extracts M6 score, net flow, and close price from the engine result.
 * Upserts on (symbol, date) — calling twice for the same session is safe.
 *
 * @param symbol  - stock symbol e.g. "BBRI"
 * @param result  - result from computeBandarmologyV2()
 * @param date    - ISO date string "YYYY-MM-DD" (use today's trading date)
 * @param netFlow - net total flow for this session (IDR)
 * @param closePrice - closing price for this session
 */
export async function saveBandarmologyHistory(
  symbol: string,
  result: BandarmologyV2Result,
  date: string,
  netFlow: number | null = null,
  closePrice: number | null = null
): Promise<void> {
  if (!symbol || typeof symbol !== "string") return;
  if (!date || typeof date !== "string") return;

  // Extract M6 score: null if model was suppressed (isReliable=false)
  const m6Output = result.M6_flowNormalized;
  const m6Score: number | null =
    m6Output && m6Output.score !== null && m6Output.score !== undefined
      ? Number(m6Output.score)
      : null;

  const record: BandarmologyHistoryRecord = {
    symbol:     symbol.toUpperCase(),
    date:       date.trim(),
    m6Score,
    netFlow:    netFlow !== null && isFinite(netFlow) ? netFlow : null,
    closePrice: closePrice !== null && isFinite(closePrice) ? closePrice : null,
  };

  try {
    await getStorage().saveRecord(record);
  } catch (err) {
    // Log but do not throw — history saving must not break the main engine call.
    console.error(`[bandarmologyHistory] saveBandarmologyHistory error for ${symbol}:`, err);
  }
}

/**
 * Get full history records for a symbol (for debugging/audit).
 * Returns full BandarmologyHistoryRecord[] ordered oldest → newest.
 */
export async function getFullHistory(
  symbol: string,
  n: number = 20
): Promise<BandarmologyHistoryRecord[]> {
  if (!symbol) return [];
  const cap = Math.max(1, Math.min(n, MAX_HISTORY_RECORDS));

  try {
    return await getStorage().getRecords(symbol, cap);
  } catch (err) {
    console.error(`[bandarmologyHistory] getFullHistory error for ${symbol}:`, err);
    return [];
  }
}

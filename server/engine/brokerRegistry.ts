/**
 * ============================================================
 * BROKER REGISTRY v1.1
 * ============================================================
 * server/engine/brokerRegistry.ts
 *
 * Static classification of IDX brokers by institutional archetype.
 * The correct axis is SMART MONEY vs DUMB MONEY — not foreign vs domestic.
 *
 * CC (Mandiri Sekuritas) is domestic but institutional.
 * AT (Stockbit) is domestic but pure retail noise.
 * KZ, YU, RX are foreign but institutional smart money.
 *
 * ALIAS SUPPORT (v1.1):
 *   Seed data uses broker name-style strings (BNI, CIMB, MBK) rather than
 *   the official 2-letter IDX broker codes (NI, YU, ZP). Aliases bridge this
 *   gap until real IDX data ingests with standard codes.
 *   getBrokerProfile() tries exact code first, then case-insensitive alias match.
 *   When real 2-letter codes arrive, exact match wins — aliases are never used.
 *
 * USAGE:
 *   isSmartMoney('CC')    → true  (exact)
 *   isSmartMoney('CIMB')  → true  (alias for YU)
 *   isRetailRail('AT')    → true
 *   classifyBrokers(brokers) → { smart, retail, unknown }
 * ============================================================
 */

export type BrokerClass = 'SMART_FOREIGN' | 'SMART_LOCAL' | 'RETAIL_RAIL' | 'WATCHLIST';

export interface BrokerProfile {
  code:        string;
  name:        string;
  staticClass: BrokerClass;
  isSmartMoney: boolean;
  isRetailRail: boolean;
  /** Alternative name-style strings that map to this broker. Case-insensitive. */
  aliases?: string[];
}

type RawEntry = Omit<BrokerProfile, 'isSmartMoney' | 'isRetailRail'>;

const BROKER_REGISTRY_RAW: RawEntry[] = [
  // ── Smart Money — Foreign Institutional ──────────────────
  { code: 'KZ', name: 'CLSA Sekuritas',             staticClass: 'SMART_FOREIGN', aliases: ['CLSA'] },
  { code: 'YU', name: 'CIMB Sekuritas',             staticClass: 'SMART_FOREIGN', aliases: ['CIMB', 'CIMBS'] },
  { code: 'RX', name: 'Macquarie Sekuritas',         staticClass: 'SMART_FOREIGN', aliases: ['MACQ', 'MACQUARIE'] },
  { code: 'AK', name: 'UBS Sekuritas',               staticClass: 'SMART_FOREIGN', aliases: ['UBS', 'UBSS'] },
  { code: 'BK', name: 'J.P. Morgan Sekuritas',       staticClass: 'SMART_FOREIGN', aliases: ['JPM', 'JPMORGAN'] },
  { code: 'MS', name: 'Morgan Stanley Sekuritas',    staticClass: 'SMART_FOREIGN', aliases: ['MORGAN'] },
  { code: 'CG', name: 'Citigroup Sekuritas',         staticClass: 'SMART_FOREIGN', aliases: ['CITI', 'CITIGROUP'] },
  { code: 'ZP', name: 'Maybank Kim Eng Sekuritas',   staticClass: 'SMART_FOREIGN', aliases: ['MBK', 'MAYBANK'] },
  { code: 'DR', name: 'Deutsche Securities',         staticClass: 'SMART_FOREIGN', aliases: [] },

  // ── Smart Money — Local Institutional ────────────────────
  { code: 'CC', name: 'Mandiri Sekuritas',           staticClass: 'SMART_LOCAL',   aliases: ['MANDIRI', 'MAND'] },
  { code: 'NI', name: 'BNI Sekuritas',               staticClass: 'SMART_LOCAL',   aliases: ['BNI', 'BNIS'] },
  { code: 'OD', name: 'Mirae Asset Sekuritas',       staticClass: 'SMART_LOCAL',   aliases: ['MIRAE_INST', 'MIRAEINST'] },
  { code: 'AI', name: 'Sinarmas Sekuritas',          staticClass: 'SMART_LOCAL',   aliases: [] },
  { code: 'DX', name: 'Bahana Sekuritas',            staticClass: 'SMART_LOCAL',   aliases: [] },
  { code: 'BR', name: 'BRI Danareksa Sekuritas',     staticClass: 'SMART_LOCAL',   aliases: [] },

  // ── Retail Rails ──────────────────────────────────────────
  { code: 'YP', name: 'Indo Premier Sekuritas',      staticClass: 'RETAIL_RAIL',   aliases: ['INDOPREMIER', 'IPOT'] },
  { code: 'PD', name: 'Indo Premier Online',         staticClass: 'RETAIL_RAIL',   aliases: [] },
  { code: 'EP', name: 'Sekuritas Equity Life',       staticClass: 'RETAIL_RAIL',   aliases: [] },
  { code: 'DB', name: 'Deutsche Retail',             staticClass: 'RETAIL_RAIL',   aliases: [] },
  { code: 'AT', name: 'Stockbit / Bibit',            staticClass: 'RETAIL_RAIL',   aliases: ['STOCKBIT'] },
  { code: 'SS', name: 'Phillip Sekuritas',           staticClass: 'RETAIL_RAIL',   aliases: [] },
  { code: 'IF', name: 'Samuel Sekuritas',            staticClass: 'RETAIL_RAIL',   aliases: [] },
  { code: 'OD_RETAIL', name: 'Mirae Asset Retail',  staticClass: 'RETAIL_RAIL',   aliases: ['MIRAE', 'MIRAERETAIL'] },

  // ── Watchlist — unknown or legacy codes ───────────────────
  // Codes observed in seed data that cannot yet be definitively classified.
  // These are excluded from M17 smart/retail computation until resolved.
  { code: 'CS',  name: 'Credit Suisse legacy / unknown', staticClass: 'WATCHLIST', aliases: [] },
  { code: 'BHS', name: 'Tidak dikenal — butuh verifikasi', staticClass: 'WATCHLIST', aliases: [] },
];

export const BROKER_REGISTRY: BrokerProfile[] = BROKER_REGISTRY_RAW.map((b) => ({
  ...b,
  isSmartMoney: b.staticClass === 'SMART_FOREIGN' || b.staticClass === 'SMART_LOCAL',
  isRetailRail: b.staticClass === 'RETAIL_RAIL',
}));

// ── Lookup maps ────────────────────────────────────────────────
// Primary: exact code (uppercase) → profile
const CODE_MAP = new Map<string, BrokerProfile>(
  BROKER_REGISTRY.map((b) => [b.code.toUpperCase(), b])
);

// Secondary: alias (uppercase) → profile
// Built lazily so aliases can be empty arrays without overhead.
const ALIAS_MAP = new Map<string, BrokerProfile>();
for (const b of BROKER_REGISTRY) {
  for (const alias of b.aliases ?? []) {
    ALIAS_MAP.set(alias.toUpperCase(), b);
  }
}

/**
 * Returns the full profile for a broker code or alias.
 * Resolution order:
 *   1. Exact code match (case-insensitive)
 *   2. Alias match (case-insensitive)
 *   3. null — caller should route to unknown[]
 *
 * Backward-compatible: when real 2-letter codes arrive, exact match wins.
 */
export function getBrokerProfile(code: string): BrokerProfile | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return CODE_MAP.get(upper) ?? ALIAS_MAP.get(upper) ?? null;
}

/** True when broker is in the SMART_FOREIGN or SMART_LOCAL class. */
export function isSmartMoney(code: string): boolean {
  return getBrokerProfile(code)?.isSmartMoney ?? false;
}

/** True when broker is in the RETAIL_RAIL class. */
export function isRetailRail(code: string): boolean {
  return getBrokerProfile(code)?.isRetailRail ?? false;
}

export interface ClassifiedBrokers<T> {
  smart:   T[];
  retail:  T[];
  unknown: T[];
}

/**
 * Partition a list of broker records by their class.
 * Records with unrecognised codes (not in registry or aliases) go into unknown[].
 * WATCHLIST-class brokers go into unknown[] — they are intentionally unclassified.
 */
export function classifyBrokers<T extends { code: string }>(
  brokers: T[]
): ClassifiedBrokers<T> {
  const smart:   T[] = [];
  const retail:  T[] = [];
  const unknown: T[] = [];

  for (const b of brokers) {
    const profile = getBrokerProfile(b.code);
    if (!profile || profile.staticClass === 'WATCHLIST') {
      unknown.push(b);
    } else if (profile.isSmartMoney) {
      smart.push(b);
    } else if (profile.isRetailRail) {
      retail.push(b);
    } else {
      unknown.push(b);
    }
  }

  return { smart, retail, unknown };
}

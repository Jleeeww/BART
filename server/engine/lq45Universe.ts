/**
 * Canonical LQ45 constituent list (May 2026 rebalancing — IDX source).
 * WIKA removed: dropped from LQ45 in Feb 2024 rebalancing (financial distress).
 * Single source of truth — import from here instead of duplicating the list
 * in gorenganDetector, routes.ts, screener filters, search priority, etc.
 */
export const LQ45_UNIVERSE = new Set([
  'AALI', 'ACES', 'ADRO', 'AKRA', 'AMRT', 'ANTM', 'ARTO', 'ASII',
  'BBCA', 'BBNI', 'BBRI', 'BMRI', 'BREN', 'BRIS', 'BSDE', 'BUKA',
  'CTRA', 'EMTK', 'ERAA', 'EXCL', 'GOTO', 'HRUM', 'ICBP', 'INCO',
  'INDF', 'INKP', 'ISAT', 'ITMG', 'JSMR', 'KLBF', 'LSIP', 'MAPI',
  'MDKA', 'MEDC', 'MYOR', 'PTBA', 'PWON', 'SIDO', 'SMRA', 'TINS',
  'TLKM', 'TOWR', 'TPIA', 'UNTR', 'UNVR',
]);

/**
 * Sector-ordered array of the full LQ45 universe, used as the Homepage display order.
 * Derived from LQ45_UNIVERSE — keep in sync if the Set changes.
 */
export const HOMEPAGE_UNIVERSE: string[] = [
  // Financials
  "BBCA", "BBRI", "BMRI", "BBNI", "BRIS", "ARTO",
  // Telecom
  "TLKM", "ISAT", "EXCL", "TOWR",
  // Consumer Staples
  "UNVR", "INDF", "ICBP", "MYOR", "KLBF", "SIDO", "AMRT",
  // Consumer Discretionary
  "ASII", "ACES", "MAPI", "ERAA",
  // Energy
  "ADRO", "PTBA", "ITMG", "MEDC", "HRUM", "AKRA",
  // Basic Materials
  "INCO", "ANTM", "MDKA", "TINS", "INKP", "TPIA",
  // Industrials
  "UNTR", "JSMR",
  // Real Estate
  "BSDE", "CTRA", "PWON", "SMRA",
  // Technology
  "GOTO", "BUKA", "EMTK",
  // Energy/Renewables & Agriculture
  "BREN", "AALI", "LSIP",
];

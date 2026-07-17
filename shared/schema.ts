import { pgTable, text, serial, numeric, timestamp, real, integer, jsonb, date, uniqueIndex, index, customType } from "drizzle-orm/pg-core";

// pgvector column — requires `CREATE EXTENSION IF NOT EXISTS vector` on the DB
// IVFFlat index must be added via raw SQL (not expressible in Drizzle DSL):
//   CREATE INDEX CONCURRENTLY ON rag_documents
//   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'vector(1536)'; },
  toDriver(v: number[]): string { return `[${v.join(',')}]`; },
  fromDriver(v: string): number[] { return v.replace(/[\[\]]/g, '').split(',').map(Number); },
});
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Auth: users + sessions ─────────────────────────────────────
// Registration flow: user registers (status=PENDING) → can log in immediately
// but all features are locked → admin approves (status=APPROVED) → unlocked.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // format: s2:<salthex>:<scrypt64hex>
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  status: text("status").notNull().default("PENDING"), // PENDING | APPROVED | REJECTED
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const authSessions = pgTable("auth_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(), // plain link (no FK, per codebase convention)
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type AuthSession = typeof authSessions.$inferSelect;

export const stocks = pgTable("stocks", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  price: numeric("price").notNull(),
  change: numeric("change").notNull(),
  changePercent: numeric("change_percent").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(), // For Overview tab
  sector: text("sector").notNull(),
  subsector: text("subsector").notNull(),
  marketCap: text("market_cap").notNull(),
  // IDX-specific fields
  idxIndices: text("idx_indices"), // JSON array: ["IDX30", "LQ45", "IDX80"]
  sectorBadge: text("sector_badge"), // e.g., "SEKTOR KEUANGAN"
  stockTags: text("stock_tags"), // JSON array: ["Bank Besar", "Blue Chip"]
  stockCharacter: text("stock_character"), // Stock personality: Defensive, Momentum, Spekulatif, Institusional
  stockCharacterDesc: text("stock_character_desc"), // Description of stock character
  retailSentiment: text("retail_sentiment"), // Retail sentiment interpretation
  foreignDomesticInterpretation: text("foreign_domestic_interpretation"), // Foreign vs domestic flow interpretation
  localRiskFactors: text("local_risk_factors"), // JSON array of Indonesia-specific risks
  retailSummary: text("retail_summary"), // Summary for retail investors
  peRatio: numeric("pe_ratio").notNull(),
  dividendYield: numeric("dividend_yield").notNull(),
  roe: numeric("roe").notNull(), // Return on Equity
  netMargin: numeric("net_margin").notNull(), // Net Profit Margin
  growth: numeric("growth").notNull(), // Year-over-year growth rate
  investorView: text("investor_view").notNull(), // How investors view this stock
  // Financial data
  financialSummary: text("financial_summary").notNull(),
  revenue2023: text("revenue_2023").notNull(),
  revenue2024: text("revenue_2024").notNull(),
  revenue2025: text("revenue_2025").notNull(),
  netProfit2023: text("net_profit_2023").notNull(),
  netProfit2024: text("net_profit_2024").notNull(),
  netProfit2025: text("net_profit_2025").notNull(),
  assets2023: text("assets_2023").notNull(),
  assets2024: text("assets_2024").notNull(),
  assets2025: text("assets_2025").notNull(),
  liabilities2023: text("liabilities_2023").notNull(),
  liabilities2024: text("liabilities_2024").notNull(),
  liabilities2025: text("liabilities_2025").notNull(),
  ocf2023: text("ocf_2023").notNull(),
  ocf2024: text("ocf_2024").notNull(),
  ocf2025: text("ocf_2025").notNull(),
  // Flow data
  tradingActivitySummary: text("trading_activity_summary").notNull(),
  flowOverviewSummary: text("flow_overview_summary").notNull(),
  flowBias: text("flow_bias").notNull(), // Accumulation, Distribution, Neutral
  flowReliability: text("flow_reliability").notNull(),
  flowIntensity: text("flow_intensity").notNull(), // Big Distribution, Moderate Distribution, Neutral, Moderate Accumulation, Big Accumulation
  brokerData: text("broker_data").notNull(), // JSON stringified array of brokers
  foreignActivityData: text("foreign_activity_data").notNull(), // JSON stringified foreign/domestic data
  avgBuyPrice: text("avg_buy_price").notNull(), // Average transaction price for buys
  avgSellPrice: text("avg_sell_price").notNull(), // Average transaction price for sells
  // News and Corporate Action data
  newsOverviewSummary: text("news_overview_summary").notNull(),
  newsImpact: text("news_impact").notNull(), // Low, Medium, High
  newsRelevance: text("news_relevance").notNull(), // Short-term, Structural
  newsFeed: text("news_feed").notNull(), // JSON stringified array of news items
  corporateActions: text("corporate_actions").notNull(), // JSON stringified array of corporate actions
  investorInterpretation: text("investor_interpretation").notNull(), // What This Means for Investors
  eventAnalysis: text("event_analysis").notNull(), // JSON stringified array of analyst-level event analysis
  financialsAnalystView: text("financials_analyst_view").notNull(), // Analyst view for financials
  flowAnalystView: text("flow_analyst_view").notNull(), // Analyst view for flow
  riskAnalystView: text("risk_analyst_view").notNull(), // Analyst view for risk
  riskData: text("risk_data").notNull(), // JSON stringified risk framework data
  insiderData: text("insider_data"), // JSON stringified insider transaction data (optional)
  aiConfidence: text("ai_confidence").default("High").notNull(), // High, Medium, Low
  // avg20d_value: IDR avg 20-session trading value for liquidity tier guard.
  // TEMPORARY SEED — populated with tier-based estimates until session_history has 20+ sessions.
  avg20dValue: real("avg20d_value"),
  scrapeSource: text("scrape_source"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStockSchema = createInsertSchema(stocks).omit({ 
  id: true, 
  updatedAt: true 
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;

// Historical Market Data for Simulation Mode
export const historicalSnapshots = pgTable("historical_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: text("snapshot_date").notNull(), // YYYY-MM-DD format
  symbol: text("symbol").notNull(),
  // OHLCV Data
  open: numeric("open").notNull(),
  high: numeric("high").notNull(),
  low: numeric("low").notNull(),
  close: numeric("close").notNull(),
  volume: numeric("volume").notNull(),
  changePercent: numeric("change_percent").notNull(),
  // Broker Summary
  brokerData: text("broker_data").notNull(), // JSON: top broker net buys/sells
  // Foreign vs Domestic Flow
  foreignBuy: numeric("foreign_buy").notNull(),
  foreignSell: numeric("foreign_sell").notNull(),
  domesticBuy: numeric("domestic_buy").notNull(),
  domesticSell: numeric("domestic_sell").notNull(),
  // Transaction Structure
  avgBuyPrice: text("avg_buy_price").notNull(),
  avgSellPrice: text("avg_sell_price").notNull(),
  // Derived Flow Data
  flowBias: text("flow_bias").notNull(),
  flowIntensity: text("flow_intensity").notNull(),
  flowReliability: text("flow_reliability").notNull(),
  // Corporate Actions/News (optional)
  corporateActions: text("corporate_actions"), // JSON array
  newsItems: text("news_items"), // JSON array
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHistoricalSnapshotSchema = createInsertSchema(historicalSnapshots).omit({
  id: true,
  createdAt: true,
});

export type HistoricalSnapshot = typeof historicalSnapshots.$inferSelect;
export type InsertHistoricalSnapshot = z.infer<typeof insertHistoricalSnapshotSchema>;

// Simulation Audit Log
export const simulationAuditLog = pgTable("simulation_audit_log", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(), // Unique ID for this simulation run
  replayDate: text("replay_date").notNull(),
  symbol: text("symbol").notNull(),
  // Analysis Results
  readinessScore: numeric("readiness_score").notNull(),
  marketRegime: text("market_regime").notNull(),
  actionGuidanceState: text("action_guidance_state").notNull(),
  actionGuidanceLabel: text("action_guidance_label").notNull(),
  homepageBucket: text("homepage_bucket").notNull(),
  isGorengan: text("is_gorengan").notNull(), // "true" or "false"
  gorenganLayers: text("gorengan_layers"), // JSON array of triggered layers
  // Validation Results
  consistencyCheck: text("consistency_check").notNull(), // PASS or FAIL
  safetyCheck: text("safety_check").notNull(), // PASS or FAIL
  uxSanityCheck: text("ux_sanity_check").notNull(), // PASS or FAIL
  overallResult: text("overall_result").notNull(), // PASS or FAIL
  failureReasons: text("failure_reasons"), // JSON array of reasons
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSimulationAuditLogSchema = createInsertSchema(simulationAuditLog).omit({
  id: true,
  createdAt: true,
});

export type SimulationAuditLog = typeof simulationAuditLog.$inferSelect;
export type InsertSimulationAuditLog = z.infer<typeof insertSimulationAuditLogSchema>;

export const sessionHistory = pgTable('session_history', {
  id:          serial('id').primaryKey(),
  symbol:      text('symbol').notNull(),
  date:        text('date').notNull(),
  session:     integer('session').notNull().default(0),

  open:        real('open'),
  high:        real('high'),
  low:         real('low'),
  close:       real('close'),
  prevClose:   real('prev_close'),
  changePct:   real('change_pct'),

  todayValue:  real('today_value'),
  avg20dValue: real('avg20d_value'),
  avgBuyPx:    real('avg_buy_px'),
  avgSellPx:   real('avg_sell_px'),

  netFlow:          real('net_flow'),
  netForeignFlow:   real('net_foreign_flow'),
  netDomesticFlow:  real('net_domestic_flow'),
  foreignBuy:       real('foreign_buy'),
  foreignSell:      real('foreign_sell'),
  domesticBuy:      real('domestic_buy'),
  domesticSell:     real('domestic_sell'),

  flowBias:        text('flow_bias'),
  flowIntensity:   text('flow_intensity'),
  flowReliability: text('flow_reliability'),

  brokerData: jsonb('broker_data'),

  m6Score:        real('m6_score'),
  compositeScore: real('composite_score'),
  regime:         text('regime'),

  dataSource: text('data_source').default('DEMO'),
  ingestedAt: text('ingested_at'),
}, (table) => ({
  symbolDateSessionIdx: uniqueIndex('session_history_symbol_date_session_idx')
    .on(table.symbol, table.date, table.session),
}));

export const insertSessionHistorySchema = createInsertSchema(sessionHistory);
export type InsertSessionHistory = z.infer<typeof insertSessionHistorySchema>;
export type SessionHistory = typeof sessionHistory.$inferSelect;

export const signalLifecycle = pgTable('signal_lifecycle', {
  id:            serial('id').primaryKey(),
  symbol:        text('symbol').notNull().unique(),

  status:        text('status').notNull().default('AKTIF'),

  baselineScore:    real('baseline_score'),
  baselineDate:     text('baseline_date'),

  currentScore:     real('current_score'),
  currentDate:      text('current_date'),
  currentRegime:    text('current_regime'),
  currentCycle:     text('current_cycle'),

  scoreDrift:       real('score_drift'),

  statusReason:     text('status_reason'),

  diragudanSessions: integer('diragukan_sessions').default(0),

  firedAt:       text('fired_at'),
  updatedAt:     text('updated_at'),
});

export const insertSignalLifecycleSchema = createInsertSchema(signalLifecycle).omit({ id: true });
export type InsertSignalLifecycle = z.infer<typeof insertSignalLifecycleSchema>;
export type SignalLifecycle = typeof signalLifecycle.$inferSelect;

// News Impact records — one row per (article × affected symbol)
export const newsImpacts = pgTable('news_impacts', {
  id:           serial('id').primaryKey(),
  articleId:    text('article_id').notNull(),
  symbol:       text('symbol').notNull(),
  sectorName:   text('sector_name'),
  eventType:    text('event_type').notNull(),
  eventSeverity: text('event_severity').notNull(),
  direction:    text('direction').notNull(),
  strength:     text('strength').notNull(),
  macroOverride: text('macro_override').notNull(),
  traderImplication: text('trader_implication'),
  requiresImmediateAttention: text('requires_immediate_attention').default('false'),
  expiryHorizon: text('expiry_horizon'),
  rawInsight:   text('raw_insight'),
  analyzedAt:   text('analyzed_at').notNull(),
}, (table) => ({
  articleSymbolIdx: uniqueIndex('news_impacts_article_symbol_idx')
    .on(table.articleId, table.symbol),
}));

export const insertNewsImpactSchema = createInsertSchema(newsImpacts).omit({ id: true });
export type InsertNewsImpact = z.infer<typeof insertNewsImpactSchema>;
export type NewsImpact = typeof newsImpacts.$inferSelect;

// Management profiles — one row per (symbol × BOD member)
export const managementProfiles = pgTable('management_profiles', {
  id:                   serial('id').primaryKey(),
  symbol:               text('symbol').notNull(),
  memberName:           text('member_name').notNull(),
  title:                text('title'),
  trackRecordScore:     real('track_record_score'),
  governanceScore:      real('governance_score'),
  insiderAlignmentScore: real('insider_alignment_score'),
  stabilityScore:       real('stability_score'),
  reputationScore:      real('reputation_score'),
  compositeScore:       real('composite_score'),
  hasCriticalRedFlag:   text('has_critical_red_flag').default('false'),
  redFlags:             text('red_flags'),  // JSON array
  keyInsight:           text('key_insight'),
  trackRecordSummary:   text('track_record_summary'),
  governanceSummary:    text('governance_summary'),
  reputationSummary:    text('reputation_summary'),
  rawFindings:          text('raw_findings'),
  reliability:          text('reliability').notNull().default('LOW'),
  researchedAt:         text('researched_at').notNull(),
}, (table) => ({
  symbolMemberIdx: uniqueIndex('management_profiles_symbol_member_idx')
    .on(table.symbol, table.memberName),
}));

export const insertManagementProfileSchema = createInsertSchema(managementProfiles).omit({ id: true });
export type InsertManagementProfile = z.infer<typeof insertManagementProfileSchema>;
export type ManagementProfile = typeof managementProfiles.$inferSelect;

// RAG knowledge base — stores embedded documents for retrieval-augmented generation
export const ragDocuments = pgTable('rag_documents', {
  id:         serial('id').primaryKey(),
  type:       text('type').notNull(), // NEWS_OUTCOME | RESEARCH_REPORT | MANAGEMENT_PROFILE | MARKET_PATTERN | MACRO_CAUSAL
  symbol:     text('symbol'),
  sector:     text('sector'),
  content:    text('content').notNull(),
  metadata:   jsonb('metadata'),
  embedding:  vector1536('embedding'),
  validUntil: timestamp('valid_until'),
  createdAt:  timestamp('created_at').defaultNow(),
}, (table) => ({
  symbolTypeIdx: index('rag_documents_symbol_type_idx').on(table.symbol, table.type),
}));

export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({ id: true, createdAt: true });
export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;

// ─── Previously unschematized tables (used via raw SQL — now registered with Drizzle) ────

export const macroFlowHistory = pgTable('macro_flow_history', {
  date:        date('date').primaryKey(),
  ihsgForeign: numeric('ihsg_foreign'),
  indogbUst:   numeric('indogb_ust'),
  indoCds:     numeric('indo_cds'),
  indoCdsSource: text('indo_cds_source'),   // PROXY | SCRAPE | null — provenance of indo_cds
  eidoVolume:  numeric('eido_volume'),
  eidoChange:  numeric('eido_change'),
  dataQuality: text('data_quality'),
  fetchedAt:   timestamp('fetched_at').defaultNow(),
});

export type MacroFlowHistory = typeof macroFlowHistory.$inferSelect;

export const macroRegimeHistory = pgTable('macro_regime_history', {
  date:         date('date').primaryKey(),
  regime:       text('regime').notNull(),
  multiplier:   numeric('multiplier'),
  confidence:   integer('confidence'),
  triggers:     jsonb('triggers'),
  durationDays: integer('duration_days'),
  computedAt:   timestamp('computed_at').defaultNow(),
});

export type MacroRegimeHistory = typeof macroRegimeHistory.$inferSelect;

export const scrapeLog = pgTable('scrape_log', {
  id:              serial('id').primaryKey(),
  runAt:           timestamp('run_at').defaultNow(),
  symbols:         text('symbols').array(),
  attempted:       integer('attempted'),
  succeeded:       integer('succeeded'),
  failed:          integer('failed'),
  durationMs:      integer('duration_ms'),
  sourceBreakdown: jsonb('source_breakdown'),
});

export type ScrapeLog = typeof scrapeLog.$inferSelect;

// ─── Runtime admin config (key-value) ───────────────────────────
// Generic KV so new runtime toggles need no migration. Canonical keys:
//   crisis_mode           { mode: 'AUTO' | 'FORCE_CRISIS' | 'FORCE_NORMAL' }
//   suppression_override  { multiplier: number | null }
//   scanner_enabled       { enabled: boolean }
//   cost_caps             { news?: number, thematic?: number, global?: number }
export const systemConfig = pgTable('system_config', {
  key:       text('key').primaryKey(),
  value:     jsonb('value').notNull(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;

// ─── Thematic Event Scanner (Layer 8) — pure labeled overlay ─────
// NEVER touches the deterministic score. Written only by the scanner.
export const thematicScan = pgTable('thematic_scan', {
  id:          serial('id').primaryKey(),
  scanAt:      timestamp('scan_at').defaultNow(),
  slot:        text('slot'),                       // AM | MIDDAY | MANUAL
  status:      text('status').notNull(),           // OK | NO_CATALYST | SKIPPED_COST | ERROR
  themes:      jsonb('themes'),
  narrative:   text('narrative'),                  // Bahasa ID "Interpretasi AI" summary
  eventCount:  integer('event_count'),
  costUsd:     numeric('cost_usd'),
  webSearches: integer('web_searches'),
  model:       text('model'),
}, (table) => ({
  scanAtIdx: index('thematic_scan_scan_at_idx').on(table.scanAt),
}));

export const insertThematicScanSchema = createInsertSchema(thematicScan).omit({ id: true, scanAt: true });
export type InsertThematicScan = z.infer<typeof insertThematicScanSchema>;
export type ThematicScan = typeof thematicScan.$inferSelect;

export const thematicStockFlags = pgTable('thematic_stock_flags', {
  id:         serial('id').primaryKey(),
  scanId:     integer('scan_id').notNull(),        // plain link (no FK, per codebase convention)
  symbol:     text('symbol').notNull(),
  theme:      text('theme'),
  direction:  text('direction'),                   // POSITIF | NEGATIF | NETRAL
  sector:     text('sector'),
  rationale:  text('rationale'),                   // Bahasa ID
  confidence: text('confidence').notNull().default('LOW'),  // TINGGI | SEDANG | RENDAH | LOW
  sourceUrls: jsonb('source_urls'),
  createdAt:  timestamp('created_at').defaultNow(),
}, (table) => ({
  scanSymbolIdx: index('thematic_stock_flags_scan_symbol_idx').on(table.scanId, table.symbol),
  symbolIdx:     index('thematic_stock_flags_symbol_idx').on(table.symbol),
}));

export const insertThematicStockFlagSchema = createInsertSchema(thematicStockFlags).omit({ id: true, createdAt: true });
export type InsertThematicStockFlag = z.infer<typeof insertThematicStockFlagSchema>;
export type ThematicStockFlag = typeof thematicStockFlags.$inferSelect;

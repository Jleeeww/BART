import { pgTable, text, serial, numeric, timestamp, real, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

  firedAt:       text('fired_at'),
  updatedAt:     text('updated_at'),
});

export const insertSignalLifecycleSchema = createInsertSchema(signalLifecycle).omit({ id: true });
export type InsertSignalLifecycle = z.infer<typeof insertSignalLifecycleSchema>;
export type SignalLifecycle = typeof signalLifecycle.$inferSelect;

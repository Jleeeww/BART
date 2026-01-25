import { pgTable, text, serial, numeric, timestamp } from "drizzle-orm/pg-core";
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

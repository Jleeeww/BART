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
  aiConfidence: text("ai_confidence").default("High").notNull(), // High, Medium, Low
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStockSchema = createInsertSchema(stocks).omit({ 
  id: true, 
  updatedAt: true 
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

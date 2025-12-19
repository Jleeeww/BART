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
  marketCap: text("market_cap").notNull(),
  peRatio: numeric("pe_ratio").notNull(),
  dividendYield: numeric("dividend_yield").notNull(),
  aiConfidence: text("ai_confidence").default("High").notNull(), // High, Medium, Low
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStockSchema = createInsertSchema(stocks).omit({ 
  id: true, 
  updatedAt: true 
});

export type Stock = typeof stocks.$inferSelect;
export type InsertStock = z.infer<typeof insertStockSchema>;

import { db } from "./db";
import { stocks, type Stock, type InsertStock } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  createStock(stock: InsertStock): Promise<Stock>;
}

export class DatabaseStorage implements IStorage {
  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol));
    return stock;
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [stock] = await db.insert(stocks).values(insertStock).returning();
    return stock;
  }
}

export const storage = new DatabaseStorage();

import { db } from "./db";
import { 
  stocks, 
  watchlist, 
  historicalSnapshots,
  simulationAuditLog,
  type Stock, 
  type InsertStock, 
  type WatchlistItem, 
  type InsertWatchlistItem,
  type HistoricalSnapshot,
  type InsertHistoricalSnapshot,
  type SimulationAuditLog,
  type InsertSimulationAuditLog
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getStockBySymbol(symbol: string): Promise<Stock | undefined>;
  getAllStocks(): Promise<Stock[]>;
  createStock(stock: InsertStock): Promise<Stock>;
  getWatchlist(): Promise<WatchlistItem[]>;
  addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem>;
  removeFromWatchlist(symbol: string): Promise<void>;
  isInWatchlist(symbol: string): Promise<boolean>;
  // Simulation methods
  getHistoricalSnapshot(symbol: string, date: string): Promise<HistoricalSnapshot | undefined>;
  getAllHistoricalSnapshots(date: string): Promise<HistoricalSnapshot[]>;
  createHistoricalSnapshot(snapshot: InsertHistoricalSnapshot): Promise<HistoricalSnapshot>;
  insertSimulationAuditLog(log: InsertSimulationAuditLog): Promise<SimulationAuditLog>;
  getSimulationAuditLogs(runId: string): Promise<SimulationAuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getStockBySymbol(symbol: string): Promise<Stock | undefined> {
    const [stock] = await db.select().from(stocks).where(eq(stocks.symbol, symbol));
    return stock;
  }

  async getAllStocks(): Promise<Stock[]> {
    return await db.select().from(stocks);
  }

  async createStock(insertStock: InsertStock): Promise<Stock> {
    const [stock] = await db.insert(stocks).values(insertStock).returning();
    return stock;
  }

  async getWatchlist(): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist).orderBy(desc(watchlist.addedAt));
  }

  async addToWatchlist(item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [watchlistItem] = await db.insert(watchlist).values(item).returning();
    return watchlistItem;
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    await db.delete(watchlist).where(eq(watchlist.symbol, symbol));
  }

  async isInWatchlist(symbol: string): Promise<boolean> {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.symbol, symbol));
    return !!item;
  }

  // Simulation methods
  async getHistoricalSnapshot(symbol: string, date: string): Promise<HistoricalSnapshot | undefined> {
    const [snapshot] = await db.select()
      .from(historicalSnapshots)
      .where(and(
        eq(historicalSnapshots.symbol, symbol),
        eq(historicalSnapshots.snapshotDate, date)
      ));
    return snapshot;
  }

  async getAllHistoricalSnapshots(date: string): Promise<HistoricalSnapshot[]> {
    return await db.select()
      .from(historicalSnapshots)
      .where(eq(historicalSnapshots.snapshotDate, date));
  }

  async createHistoricalSnapshot(snapshot: InsertHistoricalSnapshot): Promise<HistoricalSnapshot> {
    const [created] = await db.insert(historicalSnapshots).values(snapshot).returning();
    return created;
  }

  async insertSimulationAuditLog(log: InsertSimulationAuditLog): Promise<SimulationAuditLog> {
    const [created] = await db.insert(simulationAuditLog).values(log).returning();
    return created;
  }

  async getSimulationAuditLogs(runId: string): Promise<SimulationAuditLog[]> {
    return await db.select()
      .from(simulationAuditLog)
      .where(eq(simulationAuditLog.runId, runId))
      .orderBy(desc(simulationAuditLog.createdAt));
  }
}

export const storage = new DatabaseStorage();

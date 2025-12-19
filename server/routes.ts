import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed data check (simple check on startup)
  try {
    const existing = await storage.getStockBySymbol("BBCA");
    if (!existing) {
      await storage.createStock({
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        price: "11250",
        change: "50",
        changePercent: "0.45",
        summary: "BBCA shows stable fundamentals with consistent profitability and strong liquidity. Recent price movement appears driven by steady accumulation rather than speculative trading. Valuation remains relatively high compared to peers, reflecting its defensive profile. Main risk lies in slower growth versus smaller banks.",
        description: "PT Bank Central Asia Tbk is one of the largest commercial banks in Indonesia with a strong retail and SME banking franchise. Known for conservative credit policies and efficient operations.",
        marketCap: "600.2T IDR",
        peRatio: "18.5",
        dividendYield: "3.20",
        aiConfidence: "High",
      });
      console.log("Seeded BBCA stock data");
    }
  } catch (e) {
    console.error("Error seeding data (might be because tables don't exist yet):", e);
  }

  app.get(api.stocks.getBySymbol.path, async (req, res) => {
    const symbol = req.params.symbol;
    const stock = await storage.getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }
    res.json(stock);
  });

  return httpServer;
}

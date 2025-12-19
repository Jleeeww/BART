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
    const existing = await storage.getStockBySymbol("GOGL");
    if (!existing) {
      await storage.createStock({
        symbol: "GOGL",
        name: "Google (Alphabet Inc.)",
        price: "175.45",
        change: "2.35",
        changePercent: "1.36",
        summary: "GOGL shows strong momentum with recent AI advancements. Gemini 1.5 Pro launch has been well-received by the developer community. Cloud revenue continues to grow at a double-digit pace, offsetting minor ad revenue fluctuations. Analysts maintain a BUY rating with a target of $195.",
        description: "Alphabet Inc. is a holding company that gives ambitious projects the resources, freedom, and focus to make their ideas happen. It is the parent company of Google.",
        marketCap: "2.1T",
        peRatio: "24.5",
        dividendYield: "0.45",
      });
      console.log("Seeded GOGL stock data");
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

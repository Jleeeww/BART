import type { Express } from "express";
import { storage } from "../storage";

export function registerWatchlistRoutes(app: Express): void {
  app.get("/api/watchlist", async (_req, res) => {
    try {
      const watchlistItems = await storage.getWatchlist();
      res.json(watchlistItems);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const isInWatchlist = await storage.isInWatchlist(symbol);
      if (isInWatchlist) {
        return res.status(400).json({ message: "Already in watchlist" });
      }
      const watchlistItem = await storage.addToWatchlist({ symbol });
      res.json(watchlistItem);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      await storage.removeFromWatchlist(symbol);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });
}

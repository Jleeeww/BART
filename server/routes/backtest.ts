import type { Express } from "express";

export function registerBacktestRoutes(app: Express): void {
  app.post('/api/backtest', async (req, res) => {
    try {
      const symbols: string[] = req.body?.symbols ?? [];
      if (!Array.isArray(symbols) || !symbols.length)
        return res.status(400).json({ error: 'symbols array required' });
      if (symbols.length > 50)
        return res.status(400).json({ error: 'Max 50 symbols per run' });
      const { backtestAll } = await import('../engine/backtestEngine');
      res.status(200).json(await backtestAll(symbols));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/backtest/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: 'Symbol required' });
      const { backtestSymbol } = await import('../engine/backtestEngine');
      const result = await backtestSymbol(symbol);
      if (!result) return res.status(404).json({
        error: 'Insufficient historical data',
        symbol,
        minSessionsRequired: 20,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}

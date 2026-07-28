import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PriceChart } from "@/components/PriceChart";
import { BandarmologyPanel } from "@/components/BandarmologyPanel";
import { FinancialStatementsPanel } from "@/components/FinancialStatementsPanel";
import { SymbolSearch } from "@/components/SymbolSearch";
import { Card } from "@/components/ui/card";
import { useStock } from "@/hooks/use-stocks";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Check, Loader2 } from "lucide-react";

const mono = "var(--font-mono)";
const sans = "var(--font-sans)";
const DEFAULT_SYMBOL = "BBCA";

interface KeyStats {
  peRatio: number | null;
  pbv: number | null;
  dividendYield: number | null;
  roe: number | null;
  marketCap: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
}

function statFmt(n: number | null, suffix = ""): string {
  if (n == null) return "—";
  return `${n.toLocaleString("id-ID", { maximumFractionDigits: 2 })}${suffix}`;
}

function bigNumFmt(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString("id-ID");
}

/** Key-stats strip (PER/PBV/ROE/Div Yield/Market Cap/Day Range/Volume) — sourced
 * from /api/quote/:symbol (Yahoo) regardless of whether the stock is DB-seeded,
 * since that endpoint already carries the full field set. */
function KeyStatsStrip({ symbol }: { symbol: string }) {
  const { data, isLoading } = useQuery<KeyStats | null>({
    queryKey: ["/api/quote", symbol, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Card className="p-3"><div className="h-10 w-full animate-pulse bg-muted rounded" /></Card>;
  }
  if (!data) return null;

  const stats: { label: string; value: string }[] = [
    { label: "P/E", value: statFmt(data.peRatio) },
    { label: "P/BV", value: statFmt(data.pbv) },
    { label: "ROE", value: statFmt(data.roe, "%") },
    { label: "Div. Yield", value: statFmt(data.dividendYield, "%") },
    { label: "Market Cap", value: bigNumFmt(data.marketCap) },
    { label: "Day Range", value: data.dayLow != null && data.dayHigh != null ? `${statFmt(data.dayLow)} – ${statFmt(data.dayHigh)}` : "—" },
    { label: "Volume", value: bigNumFmt(data.volume) },
  ];

  return (
    <Card className="p-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {stats.map((s) => (
          <div key={s.label}>
            <p style={{ fontFamily: sans, fontSize: 11 }} className="text-text-4 uppercase tracking-wide">{s.label}</p>
            <p style={{ fontFamily: mono, fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 600 }} className="text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WatchlistButton({ symbol }: { symbol: string }) {
  const queryClient = useQueryClient();
  const { data: watchlist } = useQuery<{ symbol: string }[]>({
    queryKey: ["/api/watchlist"],
    queryFn: async () => (await apiRequest("GET", "/api/watchlist")).json(),
  });
  const inWatchlist = watchlist?.some((w) => w.symbol === symbol) ?? false;

  const add = useMutation({
    mutationFn: () => apiRequest("POST", `/api/watchlist/${symbol}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });

  return (
    <button
      onClick={() => !inWatchlist && add.mutate()}
      disabled={inWatchlist || add.isPending}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: sans, fontSize: 12, fontWeight: 700,
        padding: "8px 14px", borderRadius: 8, cursor: inWatchlist ? "default" : "pointer",
        border: `1px solid ${inWatchlist ? "var(--positive)" : "var(--signal)"}`,
        background: inWatchlist ? "transparent" : "var(--signal)",
        color: inWatchlist ? "var(--positive)" : "var(--surface-0)",
      }}
    >
      {add.isPending ? <Loader2 size={13} className="animate-spin" /> : inWatchlist ? <Check size={13} /> : <Plus size={13} />}
      {inWatchlist ? "Di Watchlist" : "Watchlist"}
    </button>
  );
}

/**
 * Terminal-style Beranda — replaces the old landing-page Homepage with a
 * Stockbit-style single-stock trading terminal: candlestick chart +
 * indicator toolbar (PriceChart, reused as-is), quarterly financial
 * statements (Yahoo Finance primary), and a bandarmology/broker-activity
 * panel in place of order-book/trade-tape (no Level-2 data source exists —
 * confirmed neither Yahoo Finance nor the Stockbit client here expose it).
 */
export default function Terminal() {
  const [, setLocation] = useLocation();
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const { data: stockResult, isLoading } = useStock(symbol);

  const full = stockResult?.kind === "full" ? stockResult.data : undefined;
  const partial = stockResult?.kind === "partial" ? stockResult.data : undefined;

  const displayName = full?.name ?? partial?.companyName ?? symbol;
  const price = full ? parseFloat(full.price) : partial?.price ?? null;
  const changePercent = full ? parseFloat(full.changePercent) : partial?.changePercent ?? null;
  const priceUp = (changePercent ?? 0) >= 0;

  return (
    <div className="min-h-screen bg-background px-3 py-4 md:px-5">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Toolbar: symbol switcher + price header + watchlist action */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div style={{ width: 260 }}>
              <SymbolSearch onSelect={(s) => setSymbol(s)} placeholder="Ganti saham..." />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 style={{ fontFamily: sans, fontSize: 20, fontWeight: 700 }} className="text-foreground">
                  {symbol}
                </h1>
                <span className="text-sm text-muted-foreground truncate">{displayName}</span>
              </div>
              {price != null && (
                <div className="flex items-baseline gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700 }} className="text-foreground">
                    Rp {price.toLocaleString("id-ID")}
                  </span>
                  {changePercent != null && (
                    <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600 }} className={priceUp ? "text-emerald-500" : "text-red-500"}>
                      {priceUp ? "▲" : "▼"} {Math.abs(changePercent).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistButton symbol={symbol} />
            <button
              onClick={() => setLocation(`/stock/${symbol}`)}
              style={{
                fontFamily: sans, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8,
                cursor: "pointer", border: "1px solid var(--border-2)", background: "transparent", color: "var(--text-2)",
              }}
            >
              Analisis Lengkap →
            </button>
          </div>
        </div>

        {isLoading && (
          <Card className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </Card>
        )}

        {!isLoading && (
          <>
            <KeyStatsStrip symbol={symbol} />

            {/* Chart panel — candlestick + timeframe/indicator toolbar, reused from StockDashboard */}
            <Card className="p-4">
              <PriceChart symbol={symbol} />
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FinancialStatementsPanel symbol={symbol} />
              {/* Bandarmology in place of order book / trade tape — no Level-2 or
                  tick-by-tick data source is available (Yahoo Finance has none;
                  Stockbit's client here only exposes broker net buy/sell). */}
              <BandarmologyPanel symbol={symbol} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

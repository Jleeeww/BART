import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Star } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface SignalData {
  symbol: string;
  status: string;
  statusReason: string;
  scoreDrift: number | null;
  baselineScore: number | null;
  currentScore: number | null;
}

interface SignalsResponse {
  signals: SignalData[];
  total: number;
  aktif: number;
  diragukan: number;
  gugur: number;
}

interface StockData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  sector: string | null;
  readinessScore: number;
  marketRegime: string;
  actionGuidance: string;
  actionState: string;
  homepageBucket: "siap_dipantau" | "watchlist_prioritas" | "hindari_dulu";
  aiSentence: string;
  isGorengan?: boolean;
}

interface WatchlistItem {
  id: number;
  symbol: string;
  addedAt: string | null;
}

const mono = "'IBM Plex Mono', monospace";
const sora = "'Sora', sans-serif";

function deriveV2(stock: StockData) {
  const score = stock.readinessScore;
  let cyclePosition: string | null = null;
  const regime = stock.marketRegime?.toLowerCase() || "";
  if (regime.includes("akumulasi") && score >= 80) cyclePosition = "ENTRY_WINDOW";
  else if (regime.includes("akumulasi") && score >= 60) cyclePosition = "KONFIRMASI_MULAI";
  else if (regime.includes("akumulasi")) cyclePosition = "TERLALU_DINI";
  else if (regime.includes("distribusi") || regime.includes("spekulatif")) cyclePosition = "WASPADAI_DISTRIBUSI";

  let flowBias: string | null = null;
  if (stock.homepageBucket === "siap_dipantau") flowBias = "Akumulasi";
  else if (stock.homepageBucket === "hindari_dulu") flowBias = "Distribusi";
  else flowBias = "Netral";

  return { cyclePosition, flowBias };
}

function scoreColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#fbbf24";
  return "#f87171";
}

function bucketAccent(bucket: string) {
  if (bucket === "siap_dipantau") return "#34d399";
  if (bucket === "watchlist_prioritas") return "#fbbf24";
  return "#f87171";
}

function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://assets.stockbit.com/logos/companies/${symbol}.png`;
  return (
    <div
      className="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {failed ? (
        <span className="text-[10px] font-bold" style={{ fontFamily: mono, color: "#38BDF8" }}>
          {symbol.slice(0, 2)}
        </span>
      ) : (
        <img
          src={src}
          alt={symbol}
          className="w-6 h-6 object-contain rounded-sm"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function CycleLabel({ position }: { position: string | null }) {
  if (!position) return <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>—</span>;
  const map: Record<string, { label: string; color: string }> = {
    ENTRY_WINDOW: { label: "▶ Entry Window", color: "#34d399" },
    KONFIRMASI_MULAI: { label: "◎ Konfirmasi", color: "#38bdf8" },
    TERLALU_DINI: { label: "○ Terlalu Dini", color: "#94a3b8" },
    WASPADAI_DISTRIBUSI: { label: "▼ Waspada Distribusi", color: "#fbbf24" },
  };
  const entry = map[position] || { label: position, color: "#6b7280" };
  return <span className="text-[11px]" style={{ fontFamily: mono, color: entry.color }}>{entry.label}</span>;
}

function FlowLabel({ bias }: { bias: string | null }) {
  if (!bias) return <span style={{ fontFamily: mono, fontSize: 11, color: "#6b7280" }}>—</span>;
  if (bias === "Akumulasi") return <span className="text-[11px]" style={{ fontFamily: mono, color: "#34d399" }}>↑ Akumulasi</span>;
  if (bias === "Distribusi") return <span className="text-[11px]" style={{ fontFamily: mono, color: "#f87171" }}>↓ Distribusi</span>;
  return <span className="text-[11px]" style={{ fontFamily: mono, color: "#6b7280" }}>→ Netral</span>;
}

interface UndoState {
  symbol: string;
  timerId: ReturnType<typeof setTimeout>;
}

export default function WatchlistPage() {
  const [undoToast, setUndoToast] = useState<UndoState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [removedSymbols, setRemovedSymbols] = useState<Set<string>>(new Set());
  const [refreshingSignals, setRefreshingSignals] = useState(false);
  const [distWarnings, setDistWarnings] = useState<Record<string, any>>({});

  const { data: watchlistItems } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const { data: allStocks } = useQuery<StockData[]>({
    queryKey: ["/api/stocks"],
  });

  const { data: signalsData } = useQuery<SignalsResponse>({
    queryKey: ["/api/signals"],
  });

  const signals = useMemo(() => {
    const map: Record<string, SignalData> = {};
    (signalsData?.signals ?? []).forEach((s: SignalData) => {
      map[s.symbol] = s;
    });
    return map;
  }, [signalsData]);

  const watchlistMap = useMemo(() => {
    const m = new Map<string, WatchlistItem>();
    watchlistItems?.forEach((w) => m.set(w.symbol, w));
    return m;
  }, [watchlistItems]);

  useEffect(() => {
    const symbols = (watchlistItems ?? []).map(w => w.symbol);
    if (!symbols.length) { setDistWarnings({}); return; }
    let cancelled = false;
    const fetchWarnings = async () => {
      const results: Record<string, any> = {};
      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const r = await fetch(`/api/distribution/${sym}`);
            if (!r.ok) return;
            const d = await r.json();
            if (d && d.alertLevel && d.alertLevel !== 'AMAN') results[sym] = d;
          } catch {}
        })
      );
      if (!cancelled) setDistWarnings(results);
    };
    fetchWarnings();
    return () => { cancelled = true; };
  }, [watchlistItems]);

  const watchlistedStocks = useMemo(() => {
    if (!allStocks || !watchlistItems) return [];
    const symbols = new Set(watchlistItems.map((w) => w.symbol));
    for (const sym of removedSymbols) symbols.delete(sym);
    return allStocks.filter((s) => symbols.has(s.symbol));
  }, [allStocks, watchlistItems, removedSymbols]);

  const counts = useMemo(() => ({
    akumulasi: watchlistedStocks.filter((s) => s.homepageBucket === "siap_dipantau").length,
    distribusi: watchlistedStocks.filter((s) => s.homepageBucket === "hindari_dulu").length,
  }), [watchlistedStocks]);

  const removeFromWatchlist = useCallback(async (symbol: string) => {
    if (undoToast) {
      clearTimeout(undoToast.timerId);
      setUndoToast(null);
      setToastVisible(false);
    }
    setRemovedSymbols((prev) => new Set(prev).add(symbol));
    const timerId = setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setUndoToast(null), 200);
    }, 3000);
    setUndoToast({ symbol, timerId });
    requestAnimationFrame(() => setToastVisible(true));
    try {
      await apiRequest("DELETE", `/api/watchlist/${symbol}`);
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {
      setRemovedSymbols((prev) => { const next = new Set(prev); next.delete(symbol); return next; });
    }
  }, [undoToast]);

  const undoRemove = useCallback(async () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);
    const symbol = undoToast.symbol;
    setToastVisible(false);
    setTimeout(() => setUndoToast(null), 200);
    setRemovedSymbols((prev) => { const next = new Set(prev); next.delete(symbol); return next; });
    try {
      await apiRequest("POST", `/api/watchlist/${symbol}`);
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {
      setRemovedSymbols((prev) => new Set(prev).add(symbol));
    }
  }, [undoToast]);

  useEffect(() => {
    return () => { if (undoToast) clearTimeout(undoToast.timerId); };
  }, [undoToast]);

  return (
    <div className="px-6 py-6 min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* SECTION A — Header */}
      <div className="mb-5">
        <p className="text-[10px] tracking-[0.25em] uppercase mb-1.5" style={{ fontFamily: mono, color: "#38BDF8" }}>
          WATCHLIST ANDA
        </p>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: sora }}>
          Saham Pantauan
        </h1>
        <p className="text-sm mt-1" style={{ fontFamily: mono, color: "#6b7280" }}>
          Kampanye akumulasi yang sedang Anda ikuti
        </p>
      </div>

      {/* Alert bar for diragukan / gugur signals */}
      {(() => {
        const diragukan = Object.values(signals).filter(s => s.status === 'DIRAGUKAN').length;
        const gugur = Object.values(signals).filter(s => s.status === 'GUGUR').length;
        if (diragukan === 0 && gugur === 0) return null;
        return (
          <div
            className="px-4 py-2 mb-3 rounded-sm flex items-center gap-3"
            style={{ background: "#1a1100", border: "1px solid rgba(245,158,11,0.2)" }}
            data-testid="signal-warning-bar"
          >
            <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(251,191,36,0.8)" }}>
              ⚠{" "}
              {diragukan > 0 ? `${diragukan} sinyal diragukan` : ""}
              {diragukan > 0 && gugur > 0 ? " · " : ""}
              {gugur > 0 ? `${gugur} sinyal gugur` : ""}
            </span>
            <span
              className="ml-auto cursor-pointer hover:underline"
              style={{ fontFamily: mono, fontSize: 10, color: "#38BDF8" }}
              data-testid="button-refresh-signals"
              onClick={async () => {
                if (refreshingSignals) return;
                setRefreshingSignals(true);
                try {
                  const symbols = watchlistedStocks.map(s => s.symbol);
                  await Promise.all(symbols.map(sym =>
                    apiRequest("POST", `/api/signals/${sym}/update`).catch(() => {})
                  ));
                  queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
                } catch {}
                setRefreshingSignals(false);
              }}
            >
              {refreshingSignals ? "Memperbarui..." : "Perbarui"}
            </span>
          </div>
        );
      })()}

      {/* Stats bar */}
      <div
        className="flex items-center justify-between px-4 py-3 mb-4 rounded-md"
        style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
        data-testid="watchlist-stats-bar"
      >
        <span className="text-sm font-bold text-white" style={{ fontFamily: mono }}>
          {watchlistedStocks.length} saham dipantau
        </span>
        <div className="flex gap-4">
          <span className="text-xs" style={{ fontFamily: mono, color: "#34d399" }}>
            {counts.akumulasi} Akumulasi
          </span>
          <span className="text-xs" style={{ fontFamily: mono, color: "#f87171" }}>
            {counts.distribusi} Distribusi
          </span>
        </div>
      </div>

      {watchlistedStocks.length === 0 ? (
        <div className="py-20 text-center" data-testid="watchlist-empty-state">
          <p
            className="text-sm mb-3"
            style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)", letterSpacing: "0.15em" }}
          >
            [ WATCHLIST KOSONG ]
          </p>
          <p className="text-xs mb-6" style={{ fontFamily: mono, color: "#6b7280" }}>
            Tambahkan saham dari Radar untuk mulai memantau
          </p>
          <Link href="/radar">
            <button
              className="px-4 py-2 rounded-sm transition-all text-[10px]"
              style={{
                fontFamily: mono,
                background: "rgba(56,189,248,0.1)",
                color: "#38BDF8",
                border: "1px solid rgba(56,189,248,0.2)",
              }}
              data-testid="button-go-to-radar"
            >
              Buka Radar →
            </button>
          </Link>
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr style={{ background: "#0d0d0d", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                {["SAHAM", "SEKTOR", "HARGA", "SKOR", "SIKLUS", "ALIRAN", "STATUS", "AKSI"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3"
                    style={{
                      fontFamily: mono,
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      color: "#6B7280",
                      textTransform: "uppercase",
                      fontWeight: 400,
                      background: "#0d0d0d",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {watchlistedStocks.map((stock) => {
                const v2 = deriveV2(stock);
                const accent = bucketAccent(stock.homepageBucket);
                return (
                  <tr
                    key={stock.symbol}
                    className="transition-colors duration-100 hover:bg-[#1a1a1a]"
                    style={{
                      background: "#161616",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      borderLeft: `2px solid ${accent}`,
                    }}
                    data-testid={`watchlist-row-${stock.symbol}`}
                  >
                    {/* SAHAM */}
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-3 py-1">
                        <StockLogo symbol={stock.symbol} />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-base font-bold text-white" style={{ fontFamily: sora }}>
                            {stock.symbol}
                          </p>
                          <p className="text-[11px] truncate" style={{ fontFamily: mono, color: "#6b7280", maxWidth: 160 }}>
                            {stock.name}
                          </p>
                          {distWarnings[stock.symbol] && (
                            <span
                              className={`inline-block font-mono text-[8px] px-1.5 py-0.5 rounded-sm border mt-0.5 w-fit ${
                                distWarnings[stock.symbol].alertLevel === 'BAHAYA_DISTRIBUSI'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : distWarnings[stock.symbol].alertLevel === 'WASPADA_DISTRIBUSI'
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                              data-testid={`badge-distwarn-${stock.symbol}`}
                            >
                              {distWarnings[stock.symbol].alertLevel === 'BAHAYA_DISTRIBUSI' && '⚠ BAHAYA DISTRIBUSI'}
                              {distWarnings[stock.symbol].alertLevel === 'WASPADA_DISTRIBUSI' && '⚠ WASPADA DISTRIBUSI'}
                              {distWarnings[stock.symbol].alertLevel === 'PANTAU_DISTRIBUSI' && '· PANTAU DISTRIBUSI'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SEKTOR */}
                    <td className="px-4 py-3 w-28">
                      <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                        {stock.sector || "—"}
                      </span>
                    </td>

                    {/* HARGA */}
                    <td className="px-4 py-3 w-28">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-white" style={{ fontFamily: mono }}>
                          Rp {parseFloat(String(stock.price).replace(/[^0-9.-]/g, "") || "0").toLocaleString("id-ID")}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            parseFloat(stock.changePercent) > 0
                              ? "text-emerald-400"
                              : parseFloat(stock.changePercent) < 0
                                ? "text-red-400"
                                : "text-[#6b7280]"
                          }`}
                          style={{ fontFamily: mono }}
                        >
                          {parseFloat(stock.changePercent) > 0
                            ? `▲ +${parseFloat(stock.changePercent).toFixed(2)}%`
                            : parseFloat(stock.changePercent) < 0
                              ? `▼ ${parseFloat(stock.changePercent).toFixed(2)}%`
                              : `— 0.00%`}
                        </span>
                      </div>
                    </td>

                    {/* SKOR */}
                    <td className="px-4 py-3 w-20">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-lg font-bold" style={{ fontFamily: mono, color: scoreColor(stock.readinessScore) }}>
                          {stock.readinessScore}
                        </span>
                        <div style={{ height: 3, width: 48, background: "rgba(255,255,255,0.06)", borderRadius: 9999 }}>
                          <div style={{
                            height: "100%",
                            width: `${stock.readinessScore}%`,
                            background: scoreColor(stock.readinessScore),
                            borderRadius: 9999,
                          }} />
                        </div>
                      </div>
                    </td>

                    {/* SIKLUS */}
                    <td className="px-4 py-3 w-40">
                      <CycleLabel position={v2.cyclePosition} />
                    </td>

                    {/* ALIRAN */}
                    <td className="px-4 py-3 w-28">
                      <FlowLabel bias={v2.flowBias} />
                    </td>

                    {/* STATUS */}
                    <td className="px-4 py-3 w-32" data-testid={`signal-status-${stock.symbol}`}>
                      {(() => {
                        const signal = signals[stock.symbol];
                        const status = signal?.status ?? 'AKTIF';
                        const drift = signal?.scoreDrift;
                        const badgeMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
                          AKTIF:     { label: '● AKTIF',     bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.3)' },
                          DIRAGUKAN: { label: '⚠ DIRAGUKAN', bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
                          GUGUR:     { label: '✕ GUGUR',     bg: 'rgba(239,68,68,0.1)',  text: '#f87171', border: 'rgba(239,68,68,0.3)' },
                        };
                        const badge = badgeMap[status] || badgeMap.AKTIF;
                        return (
                          <div title={signal?.statusReason ?? ''}>
                            <span
                              className="inline-block px-2 py-0.5 rounded-sm"
                              style={{ fontFamily: mono, fontSize: 9, color: badge.text, background: badge.bg, border: `1px solid ${badge.border}` }}
                            >
                              {badge.label}
                            </span>
                            {drift !== null && drift !== undefined && status !== 'AKTIF' && (
                              <div style={{ fontFamily: mono, fontSize: 9, color: '#6b7280', marginTop: 2 }}>
                                {drift > 0 ? `▲ +${drift}` : `▼ ${drift} poin`}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* AKSI */}
                    <td className="px-4 py-3 w-32 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => removeFromWatchlist(stock.symbol)}
                          className="p-1.5 rounded-sm border transition-all duration-150 border-amber-500/40 bg-amber-500/10 hover:border-amber-500/60 hover:bg-amber-500/20"
                          data-testid={`watchlist-star-${stock.symbol}`}
                        >
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                        </button>
                        <Link href={`/stock/${stock.symbol}`}>
                          <button
                            className="text-[10px] px-3 py-1.5 rounded-sm transition-all"
                            style={{
                              fontFamily: mono,
                              background: "rgba(56,189,248,0.1)",
                              color: "#38BDF8",
                              border: "1px solid rgba(56,189,248,0.2)",
                            }}
                            data-testid={`watchlist-detail-${stock.symbol}`}
                          >
                            ANALISIS →
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {undoToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-4 py-3 rounded-md transition-all duration-200"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            transform: `translateX(-50%) translateY(${toastVisible ? "0" : "8px"})`,
            opacity: toastVisible ? 1 : 0,
          }}
          data-testid="undo-toast"
        >
          <span className="text-xs text-white" style={{ fontFamily: mono }}>
            {undoToast.symbol} dihapus dari watchlist
          </span>
          <button
            onClick={undoRemove}
            className="text-xs cursor-pointer ml-2 transition-colors"
            style={{ fontFamily: mono, color: "#38BDF8" }}
            data-testid="button-undo-remove"
          >
            Batalkan
          </button>
        </div>
      )}
    </div>
  );
}

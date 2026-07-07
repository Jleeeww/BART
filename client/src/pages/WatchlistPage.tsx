import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// --- Interfaces ---

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

// --- Design tokens ---
const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";
const S0 = "var(--surface-0)";
const S1 = "var(--surface-1)";
const S2 = "var(--surface-2)";
const S3 = "var(--surface-3)";
const S4 = "var(--surface-4)";
const B1 = "var(--border-2)";
const B2 = "rgba(255,255,255,0.10)";
const T1 = "var(--text-1)";
const T2 = "var(--text-2)";
const T3 = "var(--text-3)";
const T4 = "var(--text-4)";
const SIGNAL = "var(--signal)";
const POSITIVE = "var(--positive)";
const WARNING = "var(--warning)";
const DANGER = "var(--danger)";

function scoreColor(s: number) {
  return s >= 60 ? "var(--positive)" : s >= 45 ? "var(--signal)" : s >= 30 ? "var(--warning)" : "var(--danger)";
}

function bucketAccent(b: string) {
  return b === "siap_dipantau" ? "var(--positive)" : b === "watchlist_prioritas" ? "var(--warning)" : "var(--danger)";
}

// --- Sub-components ---

function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://assets.stockbit.com/logos/companies/${symbol}.png`;
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: S4,
        border: `1px solid ${B1}`,
      }}
    >
      {failed ? (
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: SIGNAL }}>
          {symbol.slice(0, 2)}
        </span>
      ) : (
        <img
          src={src}
          alt={symbol}
          style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 2 }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

interface UndoState {
  symbol: string;
  timerId: ReturnType<typeof setTimeout>;
}

// --- WatchlistCard component ---

function WatchlistCard({
  item,
  stock,
  signal,
  distWarn,
  accent,
  scoreColor: sColor,
  onRemove,
  onClick,
}: {
  item: WatchlistItem;
  stock?: StockData;
  signal?: SignalData;
  distWarn?: any;
  accent: string;
  scoreColor: string;
  onRemove: () => void;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const statusColor =
    signal?.status === "aktif"
      ? POSITIVE
      : signal?.status === "diragukan"
      ? WARNING
      : signal?.status === "gugur"
      ? DANGER
      : T4;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`watchlist-row-${item.symbol}`}
      style={{
        background: hovered ? S3 : S1,
        border: `1px solid ${hovered ? B2 : B1}`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
      }}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        data-testid={`watchlist-star-${item.symbol}`}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: 3,
          cursor: "pointer",
          background: "transparent",
          border: `1px solid ${B1}`,
          color: T4,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = DANGER;
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.3)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = T4;
          (e.currentTarget as HTMLButtonElement).style.borderColor = B1;
        }}
      >
        ×
      </button>

      {/* Symbol + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingRight: 28 }}>
        <StockLogo symbol={item.symbol} />
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 700,
              color: T1,
              marginBottom: 1,
            }}
          >
            {item.symbol}
          </p>
          <p
            style={{
              fontFamily: inter,
              fontSize: 12,
              color: T3,
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {stock?.name ?? "—"}
          </p>
        </div>
      </div>

      {/* Score + status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {stock ? (
          <>
            <span
              style={{
                fontFamily: mono,
                fontSize: 26,
                fontWeight: 700,
                color: sColor,
                lineHeight: 1,
              }}
            >
              {stock.readinessScore}
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 2,
                  background: "var(--border-2)",
                  borderRadius: 9999,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${stock.readinessScore}%`,
                    background: sColor,
                    borderRadius: 9999,
                  }}
                />
              </div>
              {signal?.status && (
                <span
                  data-testid={`signal-status-${item.symbol}`}
                  style={{
                    fontFamily: mono,
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                    color: statusColor,
                  }}
                >
                  {signal.status.toUpperCase()}
                </span>
              )}
            </div>
          </>
        ) : (
          <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>[ DATA TIDAK TERSEDIA ]</span>
        )}
      </div>

      {/* Price change + sector */}
      {stock && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>{stock.sector ?? "—"}</span>
          <span
            style={{
              fontFamily: mono,
              fontSize: 12,
              color:
                parseFloat(stock.changePercent) > 0
                  ? POSITIVE
                  : parseFloat(stock.changePercent) < 0
                  ? DANGER
                  : T3,
            }}
          >
            {parseFloat(stock.changePercent) > 0
              ? `▲ +${parseFloat(stock.changePercent).toFixed(2)}%`
              : parseFloat(stock.changePercent) < 0
              ? `▼ ${parseFloat(stock.changePercent).toFixed(2)}%`
              : "—"}
          </span>
        </div>
      )}

      {/* Distribution warning */}
      {distWarn && distWarn.alertLevel !== "AMAN" && (
        <div
          style={{
            marginTop: 8,
            padding: "4px 8px",
            borderRadius: 4,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.2)",
          }}
        >
          <p
            data-testid={`badge-distwarn-${item.symbol}`}
            style={{
              fontFamily: mono,
              fontSize: 13,
              color: DANGER,
              letterSpacing: "0.06em",
            }}
          >
            ⚠{" "}
            {distWarn.alertLevel === "BAHAYA_DISTRIBUSI"
              ? "BAHAYA DISTRIBUSI"
              : distWarn.alertLevel === "WASPADA_DISTRIBUSI"
              ? "WASPADA DISTRIBUSI"
              : "PANTAU DISTRIBUSI"}
          </p>
        </div>
      )}

      {/* Detail button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = `/stock/${item.symbol}`;
        }}
        data-testid={`watchlist-detail-${item.symbol}`}
        style={{
          display: "none",
        }}
      >
        ANALISIS
      </button>
    </div>
  );
}

// --- Main page ---

export default function WatchlistPage() {
  const [removedSymbols, setRemovedSymbols] = useState<Set<string>>(new Set());
  const [undoToast, setUndoToast] = useState<UndoState | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [distWarnings, setDistWarnings] = useState<Record<string, any>>({});
  const [refreshingSignals, setRefreshingSignals] = useState(false);
  const [sortMode, setSortMode] = useState<"skor" | "status" | "nama">("skor");

  // --- Data fetching ---
  const { data: watchlistItems } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const { data: allStocks } = useQuery<StockData[]>({
    queryKey: ["/api/stocks"],
  });

  const { data: signalData } = useQuery<SignalsResponse>({
    queryKey: ["/api/signals"],
  });

  // --- Derived maps ---
  const stocksMap = useMemo(() => {
    const map: Record<string, StockData> = {};
    (allStocks ?? []).forEach((s) => {
      map[s.symbol] = s;
    });
    return map;
  }, [allStocks]);

  const signalsMap = useMemo(() => {
    const map: Record<string, SignalData> = {};
    (signalData?.signals ?? []).forEach((s: SignalData) => {
      map[s.symbol] = s;
    });
    return map;
  }, [signalData]);

  const signalSummary = signalData ?? null;

  // --- Distribution warnings ---
  useEffect(() => {
    const symbols = (watchlistItems ?? []).map((w) => w.symbol);
    if (!symbols.length) {
      setDistWarnings({});
      return;
    }
    let cancelled = false;
    const fetchWarnings = async () => {
      const results: Record<string, any> = {};
      await Promise.allSettled(
        symbols.map(async (sym) => {
          try {
            const r = await fetch(`/api/distribution/${sym}`);
            if (!r.ok) return;
            const d = await r.json();
            if (d && d.alertLevel && d.alertLevel !== "AMAN") results[sym] = d;
          } catch {}
        })
      );
      if (!cancelled) setDistWarnings(results);
    };
    fetchWarnings();
    return () => {
      cancelled = true;
    };
  }, [watchlistItems]);

  // --- Watchlist actions ---
  const removeFromWatchlist = useCallback(
    async (symbol: string) => {
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
        setRemovedSymbols((prev) => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      }
    },
    [undoToast]
  );

  const undoRemove = useCallback(async () => {
    if (!undoToast) return;
    clearTimeout(undoToast.timerId);
    const symbol = undoToast.symbol;
    setToastVisible(false);
    setTimeout(() => setUndoToast(null), 200);
    setRemovedSymbols((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    try {
      await apiRequest("POST", `/api/watchlist/${symbol}`);
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {
      setRemovedSymbols((prev) => new Set(prev).add(symbol));
    }
  }, [undoToast]);

  useEffect(() => {
    return () => {
      if (undoToast) clearTimeout(undoToast.timerId);
    };
  }, [undoToast]);

  // --- Derived watchlist state ---
  const visibleItems = useMemo(() => {
    return (watchlistItems ?? []).filter((item) => !removedSymbols.has(item.symbol));
  }, [watchlistItems, removedSymbols]);

  const watchlistedStocks = useMemo(() => {
    return visibleItems.map((item) => stocksMap[item.symbol]).filter(Boolean) as StockData[];
  }, [visibleItems, stocksMap]);

  const sortedWatchlistItems = useMemo(() => {
    if (!watchlistItems) return [];
    const visible = watchlistItems.filter((i) => !removedSymbols.has(i.symbol));
    return [...visible].sort((a, b) => {
      if (sortMode === "skor") {
        return (stocksMap[b.symbol]?.readinessScore ?? 0) - (stocksMap[a.symbol]?.readinessScore ?? 0);
      }
      if (sortMode === "status") {
        const order: Record<string, number> = { aktif: 0, diragukan: 1, gugur: 2 };
        const sa = signalsMap[a.symbol]?.status ?? "z";
        const sb = signalsMap[b.symbol]?.status ?? "z";
        return (order[sa] ?? 3) - (order[sb] ?? 3);
      }
      return a.symbol.localeCompare(b.symbol);
    });
  }, [watchlistItems, removedSymbols, sortMode, stocksMap, signalsMap]);

  // --- Alert feed items ---
  const alertItems = useMemo(() => {
    const items: {
      symbol: string;
      message: string;
      color: string;
      time: string;
      severity?: string;
    }[] = [];
    if (!watchlistItems) return items;
    watchlistItems
      .filter((i) => !removedSymbols.has(i.symbol))
      .forEach((item) => {
        const signal = signalsMap[item.symbol];
        const distWarn = distWarnings[item.symbol];
        if (signal?.status === "diragukan") {
          items.push({
            symbol: item.symbol,
            message: signal.statusReason ?? "Skor berubah signifikan",
            color: WARNING,
            time: "Sesi ini",
            severity: "DIRAGUKAN",
          });
        }
        if (signal?.status === "gugur") {
          items.push({
            symbol: item.symbol,
            message: signal.statusReason ?? "Sinyal gugur",
            color: DANGER,
            time: "Sesi ini",
            severity: "GUGUR",
          });
        }
        if (distWarn && distWarn.alertLevel !== "AMAN") {
          items.push({
            symbol: item.symbol,
            message: distWarn.recommendation ?? "Tanda distribusi terdeteksi",
            color:
              distWarn.alertLevel === "BAHAYA_DISTRIBUSI" ? DANGER : WARNING,
            time: "Saat ini",
            severity: distWarn.alertLevel,
          });
        }
        if (signal?.scoreDrift != null && Math.abs(signal.scoreDrift) >= 3) {
          items.push({
            symbol: item.symbol,
            message: `Skor ${signal.scoreDrift > 0 ? "naik" : "turun"} ${Math.abs(signal.scoreDrift)} poin`,
            color: signal.scoreDrift > 0 ? POSITIVE : DANGER,
            time: "3 sesi",
            severity: undefined,
          });
        }
      });
    return items;
  }, [watchlistItems, removedSymbols, signalsMap, distWarnings]);

  // --- Render ---
  return (
    <div style={{ minHeight: "100vh", background: S0 }}>
      {/* TOP HEADER */}
      <div style={{ padding: "20px 32px 0", borderBottom: `1px solid ${B1}` }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.2em",
                  color: T4,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                PUSAT KOMANDO PERSONAL
              </p>
              <h1
                style={{
                  fontFamily: inter,
                  fontSize: 20,
                  fontWeight: 600,
                  color: T1,
                  letterSpacing: "-0.02em",
                }}
              >
                Watchlist
              </h1>
            </div>

            {/* Stats chips — right side */}
            <div
              style={{ marginLeft: "auto", display: "flex", gap: 2 }}
              data-testid="watchlist-stats-bar"
            >
              {[
                {
                  label: "Total",
                  value: (watchlistItems?.length ?? 0) - removedSymbols.size,
                  color: T1,
                },
                { label: "Aktif", value: signalSummary?.aktif ?? 0, color: POSITIVE },
                { label: "Diragukan", value: signalSummary?.diragukan ?? 0, color: WARNING },
                { label: "Gugur", value: signalSummary?.gugur ?? 0, color: DANGER },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    background: S1,
                    border: `1px solid ${B1}`,
                    borderLeft: i > 0 ? "none" : undefined,
                    borderRadius:
                      i === 0 ? "8px 0 0 8px" : i === 3 ? "0 8px 8px 0" : 0,
                    padding: "8px 16px",
                    textAlign: "center",
                    minWidth: 72,
                  }}
                >
                  <p
                    style={{
                      fontFamily: mono,
                      fontSize: 18,
                      fontWeight: 700,
                      color: stat.color,
                      lineHeight: 1,
                      marginBottom: 2,
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontFamily: mono,
                      fontSize: 13,
                      letterSpacing: "0.1em",
                      color: T4,
                      textTransform: "uppercase",
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Signal warning bar — kept for data-testid compat */}
          {((signalSummary?.diragukan ?? 0) + (signalSummary?.gugur ?? 0)) > 0 && (
            <div
              style={{
                background: "rgba(251,191,36,0.05)",
                border: "1px solid rgba(251,191,36,0.15)",
                borderRadius: "6px 6px 0 0",
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
              data-testid="signal-warning-bar"
            >
              <span style={{ fontFamily: mono, fontSize: 12, color: WARNING, letterSpacing: "0.1em" }}>
                ⚠ PERHATIAN
              </span>
              <span style={{ fontFamily: inter, fontSize: 13, color: T2 }}>
                {signalSummary?.diragukan ?? 0} saham diragukan dan {signalSummary?.gugur ?? 0} gugur — tinjau segera.
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: mono,
                  fontSize: 12,
                  color: SIGNAL,
                  cursor: "pointer",
                }}
                data-testid="button-refresh-signals"
                onClick={async () => {
                  if (refreshingSignals) return;
                  setRefreshingSignals(true);
                  try {
                    const symbols = watchlistedStocks.map((s) => s.symbol);
                    await Promise.all(
                      symbols.map((sym) =>
                        apiRequest("POST", `/api/signals/${sym}/update`).catch(() => {})
                      )
                    );
                    queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
                  } catch {}
                  setRefreshingSignals(false);
                }}
              >
                {refreshingSignals ? "Memperbarui..." : "Perbarui"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* MAIN BODY — two columns */}
      <div
        style={{
          display: "flex",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "20px 32px 80px",
          gap: 20,
        }}
      >
        {/* LEFT: Alert Feed (28%) */}
        <div style={{ width: "28%", flexShrink: 0 }}>
          <div
            style={{
              background: S1,
              border: `1px solid ${B1}`,
              borderRadius: 10,
              overflow: "hidden",
              position: "sticky",
              top: 20,
              maxHeight: "calc(100vh - 140px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: `1px solid ${B1}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.16em",
                  color: T4,
                  textTransform: "uppercase",
                }}
              >
                UMPAN SINYAL
              </p>
              <button
                onClick={async () => {
                  if (refreshingSignals) return;
                  setRefreshingSignals(true);
                  try {
                    const symbols = watchlistedStocks.map((s) => s.symbol);
                    await Promise.all(
                      symbols.map((sym) =>
                        apiRequest("POST", `/api/signals/${sym}/update`).catch(() => {})
                      )
                    );
                    queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
                  } catch {}
                  setRefreshingSignals(false);
                }}
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  color: refreshingSignals ? T4 : T3,
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                  letterSpacing: "0.08em",
                }}
              >
                {refreshingSignals ? "..." : "↻ PERBARUI"}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {alertItems.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center" }}>
                  <p style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
                    [ TIDAK ADA SINYAL AKTIF ]
                  </p>
                </div>
              ) : (
                alertItems.map((alert, i) => (
                  <div
                    key={i}
                    onClick={() => (window.location.href = `/stock/${alert.symbol}`)}
                    style={{
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--border-1)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                      borderLeft: `3px solid ${alert.color}`,
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = S3)
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background = "transparent")
                    }
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}
                    >
                      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: T1 }}>
                        {alert.symbol}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: T4 }}>{alert.time}</span>
                    </div>
                    <p style={{ fontFamily: inter, fontSize: 13, color: T3, lineHeight: 1.4 }}>
                      {alert.message}
                    </p>
                    {alert.severity && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontFamily: mono,
                          fontSize: 12,
                          letterSpacing: "0.08em",
                          padding: "2px 5px",
                          borderRadius: 3,
                          color: alert.color,
                          background: `${alert.color}12`,
                          border: `1px solid ${alert.color}30`,
                        }}
                      >
                        {alert.severity}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Card Grid (72%) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Empty state */}
          {(!watchlistItems ||
            watchlistItems.filter((i) => !removedSymbols.has(i.symbol)).length === 0) ? (
            <div
              style={{
                background: S1,
                border: `1px solid ${B1}`,
                borderRadius: 10,
                padding: "80px 40px",
                textAlign: "center",
              }}
              data-testid="watchlist-empty-state"
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.15em",
                  color: T4,
                  marginBottom: 10,
                }}
              >
                [ WATCHLIST KOSONG ]
              </p>
              <p
                style={{
                  fontFamily: inter,
                  fontSize: 13,
                  color: T4,
                  marginBottom: 20,
                }}
              >
                Tambahkan saham dari Radar untuk mulai memantau portofolio intelijen.
              </p>
              <button
                onClick={() => (window.location.href = "/radar")}
                data-testid="button-go-to-radar"
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  padding: "10px 22px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: "rgba(79,195,247,0.1)",
                  border: "1px solid rgba(79,195,247,0.3)",
                  color: SIGNAL,
                }}
              >
                BUKA RADAR →
              </button>
            </div>
          ) : (
            <>
              {/* Sort controls */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: T4,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}
                >
                  URUT:
                </span>
                {(["skor", "status", "nama"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortMode(s)}
                    style={{
                      fontFamily: mono,
                      fontSize: 13,
                      padding: "4px 10px",
                      borderRadius: 4,
                      cursor: "pointer",
                      background:
                        sortMode === s ? "rgba(79,195,247,0.1)" : "transparent",
                      border:
                        sortMode === s
                          ? "1px solid rgba(79,195,247,0.25)"
                          : `1px solid ${B1}`,
                      color: sortMode === s ? SIGNAL : T4,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Card grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                {sortedWatchlistItems.map((item) => {
                  const stock = stocksMap[item.symbol];
                  const signal = signalsMap[item.symbol];
                  const distWarn = distWarnings[item.symbol];
                  const accent = stock ? bucketAccent(stock.homepageBucket) : B1;
                  const sColor = stock ? scoreColor(stock.readinessScore) : T4;
                  return (
                    <WatchlistCard
                      key={item.symbol}
                      item={item}
                      stock={stock}
                      signal={signal}
                      distWarn={distWarn}
                      accent={accent}
                      scoreColor={sColor}
                      onRemove={() => removeFromWatchlist(item.symbol)}
                      onClick={() => (window.location.href = `/stock/${item.symbol}`)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* UNDO TOAST */}
      {undoToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 18px",
            borderRadius: 8,
            background: S1,
            border: `1px solid ${B1}`,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
            transition: "opacity 0.2s, transform 0.2s",
            opacity: toastVisible ? 1 : 0,
            transform: toastVisible ? "translateY(0)" : "translateY(8px)",
          }}
          data-testid="undo-toast"
        >
          <span style={{ fontFamily: mono, fontSize: 13, color: T2 }}>
            {undoToast.symbol} dihapus dari watchlist
          </span>
          <button
            onClick={undoRemove}
            data-testid="button-undo-remove"
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.06em",
              cursor: "pointer",
              color: SIGNAL,
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            Batalkan
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// ─── Design tokens ────────────────────────────────────────────────────────────
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

const SIGNAL   = "var(--signal)";
const POSITIVE = "var(--positive)";
const WARNING  = "var(--warning)";
const DANGER   = "var(--danger)";

function scoreColor(s: number): string {
  return s >= 60 ? "var(--positive)" : s >= 45 ? "var(--signal)" : s >= 30 ? "var(--warning)" : "var(--danger)";
}

function bucketAccent(b: string): string {
  return b === "siap_dipantau" ? "var(--positive)" : b === "watchlist_prioritas" ? "var(--warning)" : "var(--danger)";
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StockData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  sector: string | null;
  readinessScore: number | null;
  computeError?: boolean;
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

type FilterType = "semua" | "akumulasi" | "distribusi" | "waspadai";

// ─── Filter pill config ───────────────────────────────────────────────────────
const filterPills: { key: FilterType; label: string }[] = [
  { key: "semua",      label: "Semua"      },
  { key: "akumulasi",  label: "Akumulasi"  },
  { key: "distribusi", label: "Distribusi" },
  { key: "waspadai",   label: "Waspadai"   },
];

// ─── Business logic ───────────────────────────────────────────────────────────
function deriveV2(stock: StockData) {
  const score = stock.readinessScore ?? 0;
  let cyclePosition: string | null = null;
  const regime = stock.marketRegime?.toLowerCase() || "";
  if (regime.includes("akumulasi") && score >= 80)       cyclePosition = "ENTRY_WINDOW";
  else if (regime.includes("akumulasi") && score >= 60)  cyclePosition = "KONFIRMASI_MULAI";
  else if (regime.includes("akumulasi"))                 cyclePosition = "TERLALU_DINI";
  else if (regime.includes("distribusi") || regime.includes("spekulatif"))
                                                          cyclePosition = "WASPADAI_DISTRIBUSI";

  let concentrationType: string | null = null;
  if (score >= 70)                          concentrationType = "KENDALI_BANDAR";
  else if (score >= 40 && score < 60)       concentrationType = "TERSEBAR";
  else if (stock.isGorengan || score < 40)  concentrationType = "JEBAKAN_DISTRIBUSI";

  let flowBias: string | null = null;
  if (stock.homepageBucket === "siap_dipantau")    flowBias = "Akumulasi";
  else if (stock.homepageBucket === "hindari_dulu") flowBias = "Distribusi";
  else                                              flowBias = "Netral";

  return { cyclePosition, concentrationType, flowBias };
}

// ─── Helper components ────────────────────────────────────────────────────────
function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://assets.stockbit.com/logos/companies/${symbol}.png`;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 6, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: "#111111", border: `1px solid ${B1}`,
    }}>
      {failed ? (
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: SIGNAL }}>
          {symbol.slice(0, 2)}
        </span>
      ) : (
        <img
          src={src}
          alt={symbol}
          style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 2 }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function CycleLabel({ position }: { position: string | null }) {
  if (!position) return <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>—</span>;
  const map: Record<string, { label: string; color: string }> = {
    ENTRY_WINDOW:        { label: "▶ Entry Window",  color: "var(--positive)" },
    KONFIRMASI_MULAI:    { label: "◎ Konfirmasi",    color: "var(--signal)" },
    TERLALU_DINI:        { label: "○ Terlalu Dini",  color: "var(--text-3)" },
    WASPADAI_DISTRIBUSI: { label: "▼ Distribusi",    color: "var(--warning)" },
  };
  const e = map[position] || { label: position, color: "var(--text-3)" };
  return <span style={{ fontFamily: mono, fontSize: 12, color: e.color }}>{e.label}</span>;
}

function FlowLabel({ bias }: { bias: string | null }) {
  if (!bias)               return <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>—</span>;
  if (bias === "Akumulasi")  return <span style={{ fontFamily: mono, fontSize: 12, color: "var(--positive)" }}>↑ Akumulasi</span>;
  if (bias === "Distribusi") return <span style={{ fontFamily: mono, fontSize: 12, color: "var(--danger)" }}>↓ Distribusi</span>;
  return <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)" }}>→ Netral</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RadarPage() {
  const [filter, setFilter] = useState<FilterType>("semua");
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});
  const [distWarnings, setDistWarnings] = useState<Record<string, any>>({});
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const { data: stocks, isLoading } = useQuery<StockData[]>({
    queryKey: ["/api/stocks"],
  });

  useEffect(() => {
    if (!stocks?.length) return;
    let cancelled = false;
    const fetchWarnings = async () => {
      const symbols = stocks.map((s) => s.symbol);
      const results: Record<string, any> = {};
      await Promise.allSettled(
        symbols.map(async (sym: string) => {
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
    return () => { cancelled = true; };
  }, [stocks]);

  const { data: watchlistData } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
  });

  const watchlistedSymbols = useMemo(() => {
    const base = new Set(watchlistData?.map((w) => w.symbol) ?? []);
    for (const [sym, added] of Object.entries(optimisticOverrides)) {
      if (added) base.add(sym);
      else base.delete(sym);
    }
    return base;
  }, [watchlistData, optimisticOverrides]);

  const toggleWatchlist = useCallback(async (symbol: string) => {
    const isStarred = watchlistedSymbols.has(symbol);
    setOptimisticOverrides((prev) => ({ ...prev, [symbol]: !isStarred }));
    try {
      if (isStarred) {
        await apiRequest("DELETE", `/api/watchlist/${symbol}`);
      } else {
        await apiRequest("POST", `/api/watchlist/${symbol}`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {
      setOptimisticOverrides((prev) => ({ ...prev, [symbol]: isStarred }));
    }
  }, [watchlistedSymbols]);

  const filtered = useMemo(() => {
    if (!stocks) return [];
    let list = stocks;
    if (filter === "akumulasi") {
      list = list.filter(s => s.homepageBucket === "siap_dipantau" || s.homepageBucket === "watchlist_prioritas");
    } else if (filter === "distribusi") {
      list = list.filter(s => s.homepageBucket === "hindari_dulu");
    } else if (filter === "waspadai") {
      list = list.filter(s => (s.readinessScore ?? 0) >= 40 && (s.readinessScore ?? 0) <= 59);
    }
    return list;
  }, [stocks, filter]);

  // Sector heatmap data
  const sectorMap = useMemo(() => {
    if (!stocks?.length) return {};
    const map: Record<string, { stocks: StockData[]; avgScore: number; topCount: number; distribution: number }> = {};
    stocks.forEach(s => {
      const sec = s.sector ?? "Lainnya";
      if (!map[sec]) map[sec] = { stocks: [], avgScore: 0, topCount: 0, distribution: 0 };
      map[sec].stocks.push(s);
    });
    Object.keys(map).forEach(sec => {
      const ss = map[sec].stocks;
      map[sec].avgScore = Math.round(ss.reduce((a, s) => a + (s.readinessScore ?? 0), 0) / ss.length);
      map[sec].topCount = ss.filter(s => (s.readinessScore ?? 0) >= 50).length;
      map[sec].distribution = ss.filter(s => s.homepageBucket === "hindari_dulu").length;
    });
    return map;
  }, [stocks]);

  // Filter by selected sector on top of the filter-pill filtered list
  const visibleStocks = useMemo(() => {
    if (!selectedSector) return filtered;
    return filtered.filter(s => (s.sector ?? "Lainnya") === selectedSector);
  }, [filtered, selectedSector]);

  return (
    <div style={{ minHeight: "100vh", background: S0, padding: "0 0 80px" }}>

      {/* ZONE A — Page Header */}
      <div style={{ padding: "20px 32px 0", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div>
            <p style={{
              fontFamily: mono, fontSize: 12, letterSpacing: "0.2em", color: T4,
              textTransform: "uppercase", marginBottom: 4,
            }}>
              RADAR INSTITUSIONAL · IDX
            </p>
            <h1 style={{
              fontFamily: inter, fontSize: 20, fontWeight: 600, color: T1,
              letterSpacing: "-0.02em",
            }}>
              Pemindaian Pasar
            </h1>
          </div>

          {/* Filter pills — right side */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {filterPills.map(pill => {
              const active = filter === pill.key;
              return (
                <button
                  key={pill.key}
                  onClick={() => setFilter(pill.key)}
                  style={{
                    fontFamily: mono, fontSize: 12, letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                    background: active ? "rgba(79,195,247,0.1)" : "transparent",
                    border: active ? "1px solid rgba(79,195,247,0.3)" : `1px solid ${B1}`,
                    color: active ? SIGNAL : T3,
                    transition: "all 0.15s",
                  }}
                  data-testid={`filter-${pill.key}`}
                >
                  {pill.label}
                </button>
              );
            })}
            {selectedSector && (
              <button
                onClick={() => setSelectedSector(null)}
                style={{
                  fontFamily: mono, fontSize: 12, padding: "5px 12px", borderRadius: 6,
                  cursor: "pointer",
                  background: "rgba(167,139,250,0.1)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  color: "#A78BFA",
                }}
              >
                {selectedSector} ×
              </button>
            )}
          </div>
        </div>

        {/* ZONE B — Sector Heatmap */}
        {stocks && stocks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{
              fontFamily: mono, fontSize: 13, letterSpacing: "0.16em", color: T4,
              textTransform: "uppercase", marginBottom: 10,
            }}>
              PETA SEKTOR · klik untuk filter
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 8,
            }}>
              {Object.entries(sectorMap)
                .sort((a, b) => b[1].avgScore - a[1].avgScore)
                .map(([sector, data]) => {
                  const color = scoreColor(data.avgScore);
                  const isSelected = selectedSector === sector;
                  const pct = data.stocks.length > 0
                    ? (data.topCount / data.stocks.length) * 100
                    : 0;
                  const bgOpacity = Math.max(0.05, Math.min(0.2, (data.avgScore / 100) * 0.22));
                  const bgHex = Math.round(bgOpacity * 255).toString(16).padStart(2, "0");
                  return (
                    <div
                      key={sector}
                      onClick={() => setSelectedSector(isSelected ? null : sector)}
                      style={{
                        background: `${color}${bgHex}`,
                        border: isSelected ? `1px solid ${color}` : `1px solid ${color}22`,
                        borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: isSelected ? `0 0 12px ${color}20` : "none",
                      }}
                    >
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", marginBottom: 8,
                      }}>
                        <p style={{
                          fontFamily: inter, fontSize: 13, fontWeight: 600,
                          color: T1, lineHeight: 1.3,
                        }}>
                          {sector}
                        </p>
                        <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
                          {data.stocks.length}
                        </span>
                      </div>
                      <p style={{
                        fontFamily: mono, fontSize: 22, fontWeight: 700,
                        color, lineHeight: 1, marginBottom: 6,
                      }}>
                        {data.avgScore}
                      </p>
                      <div style={{
                        height: 2, background: "var(--border-2)",
                        borderRadius: 9999, marginBottom: 5,
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: color, borderRadius: 9999,
                        }} />
                      </div>
                      <p style={{ fontFamily: mono, fontSize: 13, color: T4 }}>
                        {data.topCount}/{data.stocks.length} ≥ 50
                        {data.distribution > 0 && (
                          <span style={{ color: DANGER, marginLeft: 6 }}>
                            · {data.distribution} distribusi
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ZONE C — Stats bar */}
        <div style={{
          display: "flex", gap: 20, alignItems: "center",
          padding: "10px 14px", background: S1,
          border: `1px solid ${B1}`, borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: T3 }}>
            {visibleStocks.length} saham
            {selectedSector ? ` di ${selectedSector}` : ""}
          </span>
          <span style={{ width: 1, height: 14, background: B1 }} />
          <span style={{ fontFamily: mono, fontSize: 12, color: POSITIVE }}>
            {visibleStocks.filter(s => s.homepageBucket === "siap_dipantau").length} Akumulasi
          </span>
          <span style={{ fontFamily: mono, fontSize: 12, color: WARNING }}>
            {visibleStocks.filter(s => s.homepageBucket === "watchlist_prioritas").length} Dipantau
          </span>
          <span style={{ fontFamily: mono, fontSize: 12, color: DANGER }}>
            {visibleStocks.filter(s => s.homepageBucket === "hindari_dulu").length} Distribusi
          </span>
        </div>
      </div>

      {/* ZONE D — Stock Intelligence List */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px 80px" }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              height: 56, background: S1, borderRadius: 6,
              marginBottom: 4, border: `1px solid ${B1}`,
            }} />
          ))
        ) : visibleStocks.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <p style={{
              fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.12em",
            }}>
              [ TIDAK ADA SAHAM TERDETEKSI ]
            </p>
          </div>
        ) : (
          <div style={{ borderRadius: 10, border: `1px solid ${B1}`, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 100px 160px 110px 130px",
              background: S0, borderBottom: `1px solid ${B1}`, padding: "8px 0",
            }}>
              {["SAHAM", "SEKTOR", "HARGA", "SKOR", "SIKLUS", "ALIRAN", "AKSI"].map((h, i) => (
                <div key={h} style={{
                  fontFamily: mono, fontSize: 13, letterSpacing: "0.14em", color: T4,
                  textTransform: "uppercase", padding: "0 16px",
                  textAlign: i >= 6 ? "right" : "left",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {visibleStocks.map((stock) => {
              const v2 = deriveV2(stock);
              const accent = bucketAccent(stock.homepageBucket);
              const distWarn = distWarnings[stock.symbol];
              return (
                <div
                  key={stock.symbol}
                  onClick={() => window.location.href = `/stock/${stock.symbol}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 100px 160px 110px 130px",
                    background: S1,
                    borderBottom: "1px solid var(--border-1)",
                    borderLeft: `2px solid ${accent}`,
                    cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = S3}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = S1}
                  data-testid={`radar-row-${stock.symbol}`}
                >
                  {/* SAHAM */}
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <StockLogo symbol={stock.symbol} />
                    <div>
                      <p style={{
                        fontFamily: mono, fontSize: 13, fontWeight: 700,
                        color: T1, marginBottom: 1,
                      }}>
                        {stock.symbol}
                      </p>
                      <p style={{
                        fontFamily: inter, fontSize: 12, color: T3,
                        maxWidth: 150, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {stock.name}
                      </p>
                      {distWarn && (
                        <span
                          style={{
                            display: "inline-block", marginTop: 2,
                            fontFamily: mono, fontSize: 12, letterSpacing: "0.06em",
                            padding: "1px 5px", borderRadius: 3,
                            color: distWarn.alertLevel === "BAHAYA_DISTRIBUSI" ? DANGER : WARNING,
                            background: distWarn.alertLevel === "BAHAYA_DISTRIBUSI"
                              ? "rgba(248,113,113,0.08)"
                              : "rgba(251,191,36,0.08)",
                            border: `1px solid ${distWarn.alertLevel === "BAHAYA_DISTRIBUSI"
                              ? "rgba(248,113,113,0.2)"
                              : "rgba(251,191,36,0.2)"}`,
                          }}
                          data-testid={`badge-distwarn-${stock.symbol}`}
                        >
                          {distWarn.alertLevel === "BAHAYA_DISTRIBUSI"
                            ? "⚠ BAHAYA"
                            : distWarn.alertLevel === "WASPADA_DISTRIBUSI"
                            ? "⚠ WASPADA"
                            : "· PANTAU"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SEKTOR */}
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center" }}>
                    <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
                      {stock.sector ?? "—"}
                    </span>
                  </div>

                  {/* HARGA */}
                  <div style={{
                    padding: "10px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <p style={{
                      fontFamily: mono, fontSize: 12, fontWeight: 600,
                      color: T1, marginBottom: 2,
                    }}>
                      {parseFloat(String(stock.price).replace(/[^0-9.-]/g, "") || "0").toLocaleString("id-ID")}
                    </p>
                    <p style={{
                      fontFamily: mono, fontSize: 12,
                      color: parseFloat(stock.changePercent) > 0
                        ? POSITIVE
                        : parseFloat(stock.changePercent) < 0
                        ? DANGER
                        : T3,
                    }}>
                      {parseFloat(stock.changePercent) > 0
                        ? `▲ +${parseFloat(stock.changePercent).toFixed(2)}%`
                        : parseFloat(stock.changePercent) < 0
                        ? `▼ ${parseFloat(stock.changePercent).toFixed(2)}%`
                        : "— 0.00%"}
                    </p>
                  </div>

                  {/* SKOR */}
                  <div style={{
                    padding: "10px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <p style={{
                      fontFamily: mono, fontSize: 20, fontWeight: 700,
                      color: scoreColor(stock.readinessScore ?? 0), lineHeight: 1, marginBottom: 4,
                    }}>
                      {stock.computeError ? "—" : stock.readinessScore}
                    </p>
                    <div style={{
                      width: 44, height: 2,
                      background: "var(--border-2)", borderRadius: 9999,
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${stock.readinessScore ?? 0}%`,
                        background: scoreColor(stock.readinessScore ?? 0),
                        borderRadius: 9999,
                      }} />
                    </div>
                  </div>

                  {/* SIKLUS */}
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center" }}>
                    <CycleLabel position={v2.cyclePosition} />
                  </div>

                  {/* ALIRAN */}
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center" }}>
                    <FlowLabel bias={v2.flowBias} />
                  </div>

                  {/* AKSI */}
                  <div style={{
                    padding: "10px 16px",
                    display: "flex", alignItems: "center",
                    justifyContent: "flex-end", gap: 6,
                  }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleWatchlist(stock.symbol); }}
                      style={{
                        width: 26, height: 26, borderRadius: 4, cursor: "pointer",
                        border: watchlistedSymbols.has(stock.symbol)
                          ? "1px solid rgba(251,191,36,0.3)"
                          : `1px solid ${B1}`,
                        background: watchlistedSymbols.has(stock.symbol)
                          ? "rgba(251,191,36,0.1)"
                          : "transparent",
                        color: watchlistedSymbols.has(stock.symbol) ? WARNING : T4,
                        fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.12s",
                      }}
                      data-testid={`radar-star-${stock.symbol}`}
                    >
                      ★
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); window.location.href = `/stock/${stock.symbol}`; }}
                      style={{
                        fontFamily: mono, fontSize: 13, letterSpacing: "0.08em",
                        padding: "4px 10px", borderRadius: 4, cursor: "pointer",
                        background: "rgba(79,195,247,0.08)",
                        border: "1px solid rgba(79,195,247,0.2)",
                        color: SIGNAL,
                      }}
                      data-testid={`radar-detail-${stock.symbol}`}
                    >
                      ANALISIS →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

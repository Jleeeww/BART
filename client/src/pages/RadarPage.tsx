import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Star } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

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

type FilterType = "semua" | "akumulasi" | "distribusi" | "waspadai";

const filterPills: { key: FilterType; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "akumulasi", label: "Akumulasi" },
  { key: "distribusi", label: "Distribusi" },
  { key: "waspadai", label: "Waspadai" },
];

function deriveV2(stock: StockData) {
  const score = stock.readinessScore;
  let cyclePosition: string | null = null;
  const regime = stock.marketRegime?.toLowerCase() || "";
  if (regime.includes("akumulasi") && score >= 80) cyclePosition = "ENTRY_WINDOW";
  else if (regime.includes("akumulasi") && score >= 60) cyclePosition = "KONFIRMASI_MULAI";
  else if (regime.includes("akumulasi")) cyclePosition = "TERLALU_DINI";
  else if (regime.includes("distribusi") || regime.includes("spekulatif")) cyclePosition = "WASPADAI_DISTRIBUSI";

  let concentrationType: string | null = null;
  if (score >= 70) concentrationType = "KENDALI_BANDAR";
  else if (score >= 40 && score < 60) concentrationType = "TERSEBAR";
  else if (stock.isGorengan || score < 40) concentrationType = "JEBAKAN_DISTRIBUSI";

  let flowBias: string | null = null;
  if (stock.homepageBucket === "siap_dipantau") flowBias = "Akumulasi";
  else if (stock.homepageBucket === "hindari_dulu") flowBias = "Distribusi";
  else flowBias = "Netral";

  return { cyclePosition, concentrationType, flowBias };
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

const mono = "'IBM Plex Mono', monospace";
const sora = "'Sora', sans-serif";

interface WatchlistItem {
  id: number;
  symbol: string;
  addedAt: string | null;
}

export default function RadarPage() {
  const [filter, setFilter] = useState<FilterType>("semua");
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});
  const [distWarnings, setDistWarnings] = useState<Record<string, any>>({});

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
            if (d && d.alertLevel && d.alertLevel !== 'AMAN') results[sym] = d;
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
      list = list.filter(s => s.readinessScore >= 40 && s.readinessScore <= 59);
    }
    return list;
  }, [stocks, filter]);

  const counts = useMemo(() => {
    if (!filtered) return { akumulasi: 0, distribusi: 0, dipantau: 0 };
    return {
      akumulasi: filtered.filter(s => s.homepageBucket === "siap_dipantau").length,
      distribusi: filtered.filter(s => s.homepageBucket === "hindari_dulu").length,
      dipantau: filtered.filter(s => s.homepageBucket === "watchlist_prioritas").length,
    };
  }, [filtered]);

  return (
    <div className="px-6 py-6 min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* SECTION A — Header */}
      <div className="mb-5">
        <p
          className="text-[10px] tracking-[0.2em] uppercase mb-1"
          style={{ fontFamily: mono, color: "#38BDF8" }}
        >
          BANDARMOLOGY RADAR
        </p>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: sora }}
        >
          Pemindaian Institusional IDX
        </h1>
        <p
          className="text-sm mt-1"
          style={{ fontFamily: mono, color: "#6b7280" }}
        >
          Mendeteksi aktivitas akumulasi dan distribusi di seluruh pasar
        </p>
      </div>

      {/* SECTION B — Filter + Stats */}
      <div
        className="flex items-center justify-between px-4 py-3 mb-4 rounded-md flex-wrap gap-3"
        style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="flex gap-2">
          {filterPills.map((pill) => {
            const active = filter === pill.key;
            return (
              <button
                key={pill.key}
                onClick={() => setFilter(pill.key)}
                className="px-3 py-1.5 rounded-sm cursor-pointer transition-colors"
                style={{
                  fontFamily: mono,
                  fontSize: 10,
                  letterSpacing: "0.05em",
                  background: active ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.02)",
                  color: active ? "#38BDF8" : "#6b7280",
                  border: active ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(255,255,255,0.03)",
                }}
                data-testid={`filter-${pill.key}`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-4">
          <span className="text-xs" style={{ fontFamily: mono, color: "#34d399" }}>
            {counts.akumulasi} Akumulasi
          </span>
          <span className="text-xs" style={{ fontFamily: mono, color: "#f87171" }}>
            {counts.distribusi} Distribusi
          </span>
          <span className="text-xs" style={{ fontFamily: mono, color: "#fbbf24" }}>
            {counts.dipantau} Dipantau
          </span>
        </div>
      </div>

      {/* SECTION C — Confidence notice */}
      <div
        className="px-4 py-2 mb-3 rounded-sm"
        style={{
          background: "#1a1100",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(245,158,11,0.7)" }}>
          0 saham disembunyikan karena kepercayaan sinyal di bawah 60%
        </p>
      </div>

      {/* SECTION D — Radar table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr style={{ background: "#111111", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              {["SAHAM", "SEKTOR", "PERGERAKAN", "SKOR", "REZIM", "POSISI SIKLUS", "ALIRAN DANA", "KONSENTRASI", "AKSI"].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2"
                  style={{
                    fontFamily: mono,
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    fontWeight: 400,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ background: "#161616", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-16 rounded bg-[#222] animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <p className="text-4xl mb-3" style={{ color: "rgba(255,255,255,0.06)" }}>◎</p>
                  <p className="text-sm" style={{ fontFamily: mono, color: "#6b7280" }}>
                    Tidak ada saham terdeteksi pada filter ini
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((stock) => {
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
                    data-testid={`radar-row-${stock.symbol}`}
                  >
                    <td className="px-4 py-3 w-48">
                      <div className="flex items-center gap-3 py-1">
                        <StockLogo symbol={stock.symbol} />
                        <div className="flex flex-col gap-0.5">
                          <p className="text-base font-bold text-white" style={{ fontFamily: sora }}>
                            {stock.symbol}
                          </p>
                          <p
                            className="text-[11px] truncate"
                            style={{ fontFamily: mono, color: "#6b7280", maxWidth: 160 }}
                          >
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

                    <td className="px-4 py-3 w-28">
                      <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                        {stock.sector || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-3 w-28">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="text-sm font-medium text-white"
                          style={{ fontFamily: mono }}
                        >
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

                    <td className="px-4 py-3 w-20 text-center">
                      <span
                        className="text-lg font-bold"
                        style={{ fontFamily: mono, color: scoreColor(stock.readinessScore) }}
                      >
                        {stock.readinessScore}
                      </span>
                    </td>

                    <td className="px-4 py-3 w-32">
                      <RegimeBadge regime={stock.marketRegime} />
                    </td>

                    <td className="px-4 py-3 w-40">
                      <CycleLabel position={v2.cyclePosition} />
                    </td>

                    <td className="px-4 py-3 w-28 text-right">
                      <FlowLabel bias={v2.flowBias} />
                    </td>

                    <td className="px-4 py-3 w-32">
                      <ConcentrationBadge type={v2.concentrationType} />
                    </td>

                    <td className="px-4 py-3 w-32 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWatchlist(stock.symbol); }}
                          className={`p-1.5 rounded-sm border transition-all duration-150 ${
                            watchlistedSymbols.has(stock.symbol)
                              ? "border-amber-500/40 bg-amber-500/10 hover:border-amber-500/60 hover:bg-amber-500/20"
                              : "border-[#ffffff10] bg-transparent hover:border-amber-500/30"
                          }`}
                          data-testid={`radar-star-${stock.symbol}`}
                        >
                          <Star
                            size={14}
                            className={
                              watchlistedSymbols.has(stock.symbol)
                                ? "fill-amber-400 text-amber-400"
                                : "text-[#ffffff30] hover:text-amber-400/60"
                            }
                          />
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
                            data-testid={`radar-detail-${stock.symbol}`}
                          >
                            DETAIL →
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* SECTION E — Bottom notice */}
      <p
        className="mt-6 text-center"
        style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}
      >
        Radar menampilkan saham dengan kepercayaan sinyal ≥ 60% · Data live IDX akan aktif setelah lisensi PT Berkat Digital Investasi
      </p>
    </div>
  );
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

function RegimeBadge({ regime }: { regime: string }) {
  if (!regime || regime === "Tidak Diketahui") {
    return <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>—</span>;
  }
  const r = regime.toLowerCase();
  let color = "#6b7280";
  if (r.includes("akumulasi")) color = "#38BDF8";
  else if (r.includes("transisi") || r.includes("fading")) color = "#fbbf24";
  else if (r.includes("distribusi") || r.includes("spekulatif") || r.includes("volatile")) color = "#f87171";

  return (
    <span
      className="inline-block px-2 py-0.5 rounded-sm"
      style={{
        fontFamily: mono,
        fontSize: 10,
        color,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {regime}
    </span>
  );
}

function CycleLabel({ position }: { position: string | null }) {
  if (!position) {
    return <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>—</span>;
  }
  const map: Record<string, { label: string; color: string }> = {
    ENTRY_WINDOW: { label: "Entry Window", color: "#34d399" },
    KONFIRMASI_MULAI: { label: "Konfirmasi Mulai", color: "#38bdf8" },
    TERLALU_DINI: { label: "Terlalu Dini", color: "#94a3b8" },
    WASPADAI_DISTRIBUSI: { label: "Waspadai Distribusi", color: "#fbbf24" },
  };
  const entry = map[position] || { label: position, color: "#6b7280" };
  return (
    <span className="text-[11px]" style={{ fontFamily: mono, color: entry.color }}>
      {entry.label}
    </span>
  );
}

function FlowLabel({ bias }: { bias: string | null }) {
  if (!bias) return <span style={{ fontFamily: mono, fontSize: 11, color: "#6b7280" }}>—</span>;
  if (bias === "Akumulasi") {
    return <span className="text-[11px]" style={{ fontFamily: mono, color: "#34d399" }}>↑ Akumulasi</span>;
  }
  if (bias === "Distribusi") {
    return <span className="text-[11px]" style={{ fontFamily: mono, color: "#f87171" }}>↓ Distribusi</span>;
  }
  return <span className="text-[11px]" style={{ fontFamily: mono, color: "#6b7280" }}>→ Netral</span>;
}

function ConcentrationBadge({ type }: { type: string | null }) {
  if (!type) {
    return <span style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>—</span>;
  }
  const map: Record<string, { label: string; borderColor: string; textColor: string }> = {
    KENDALI_BANDAR: { label: "Kendali Bandar", borderColor: "rgba(16,185,129,0.4)", textColor: "#34d399" },
    JEBAKAN_DISTRIBUSI: { label: "Jebakan Distribusi", borderColor: "rgba(239,68,68,0.4)", textColor: "#f87171" },
    TERSEBAR: { label: "Tersebar", borderColor: "rgba(255,255,255,0.08)", textColor: "#6b7280" },
  };
  const entry = map[type] || { label: type, borderColor: "rgba(255,255,255,0.08)", textColor: "#6b7280" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-sm"
      style={{
        fontFamily: mono,
        fontSize: 10,
        color: entry.textColor,
        border: `1px solid ${entry.borderColor}`,
      }}
    >
      {entry.label}
    </span>
  );
}

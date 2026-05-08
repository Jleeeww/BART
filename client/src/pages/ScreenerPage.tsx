import { useState, useMemo, useCallback } from "react";
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

interface WatchlistItem {
  id: number;
  symbol: string;
  addedAt: string | null;
}

type SortKey = "score_desc" | "score_asc" | "name_az" | "change_desc";

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

function pillStyle(active: boolean) {
  return {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: "0.06em",
    background: active ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.02)",
    color: active ? "#38BDF8" : "#6b7280",
    border: active ? "1px solid rgba(56,189,248,0.40)" : "1px solid #1F2937",
  };
}

const disabledPillStyle = {
  fontFamily: mono,
  fontSize: 10,
  background: "rgba(255,255,255,0.02)",
  color: "#6b7280",
  border: "1px solid #1F2937",
};

function MultiPills({
  options, selected, onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className="px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150"
          style={pillStyle(selected.has(opt))}
          data-testid={`screener-pill-${opt.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function DisabledGroup({ label, options }: { label: string; options: string[] }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
          {label}
        </p>
        <span
          className="px-2 py-0.5 rounded-sm"
          style={{
            fontFamily: mono, fontSize: 9,
            background: "rgba(56,189,248,0.06)",
            color: "rgba(56,189,248,0.4)",
            border: "1px solid rgba(56,189,248,0.15)",
          }}
          data-testid={`badge-live-idx-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          Live IDX
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 opacity-30 pointer-events-none">
        {options.map((opt) => (
          <span key={opt} className="px-3 py-1.5 rounded-md cursor-not-allowed" style={disabledPillStyle}>
            {opt}
          </span>
        ))}
      </div>
      <p className="text-[9px] mt-1.5" style={{ fontFamily: mono, color: "rgba(255,255,255,0.08)" }}>
        Tersedia dengan data IDX live
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

export default function ScreenerPage() {
  const [rezimFilter, setRezimFilter] = useState<Set<string>>(new Set(["Semua"]));
  const [siklusFilter, setSiklusFilter] = useState<Set<string>>(new Set(["Semua"]));
  const [minScore, setMinScore] = useState(0);
  const [sektorFilter, setSektorFilter] = useState<Set<string>>(new Set(["Semua"]));
  const [flowFilter, setFlowFilter] = useState<Set<string>>(new Set(["Semua"]));
  const [sortKey, setSortKey] = useState<SortKey>("score_desc");
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});

  const { data: stocks, isLoading } = useQuery<StockData[]>({ queryKey: ["/api/stocks"] });
  const { data: watchlistData } = useQuery<WatchlistItem[]>({ queryKey: ["/api/watchlist"] });

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
      if (isStarred) await apiRequest("DELETE", `/api/watchlist/${symbol}`);
      else await apiRequest("POST", `/api/watchlist/${symbol}`);
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
    } catch {
      setOptimisticOverrides((prev) => ({ ...prev, [symbol]: isStarred }));
    }
  }, [watchlistedSymbols]);

  const sectors = useMemo(() => {
    if (!stocks) return [];
    const unique = new Set(stocks.map((s) => s.sector).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [stocks]);

  function toggleMulti(current: Set<string>, value: string, setter: (s: Set<string>) => void) {
    if (value === "Semua") { setter(new Set(["Semua"])); return; }
    const next = new Set(current);
    next.delete("Semua");
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === 0) next.add("Semua");
    setter(next);
  }

  const filtered = useMemo(() => {
    if (!stocks) return [];
    let list = stocks.map((s) => ({ ...s, _v2: deriveV2(s) }));

    if (!rezimFilter.has("Semua")) {
      list = list.filter((s) => {
        const r = s.marketRegime?.toLowerCase() || "";
        const fb = s._v2.flowBias;
        for (const sel of rezimFilter) {
          if (sel === "Akumulasi" && (r.includes("akumulasi") || fb === "Akumulasi")) return true;
          if (sel === "Transisi" && (r.includes("transisi") || r.includes("fading"))) return true;
          if (sel === "Distribusi" && (r.includes("distribusi") || fb === "Distribusi")) return true;
          if (sel === "Volatile" && r.includes("volatile")) return true;
        }
        return false;
      });
    }

    if (!siklusFilter.has("Semua")) {
      const cycleMap: Record<string, string> = {
        "Terlalu Dini": "TERLALU_DINI",
        "Konfirmasi Mulai": "KONFIRMASI_MULAI",
        "Entry Window": "ENTRY_WINDOW",
        "Waspadai Distribusi": "WASPADAI_DISTRIBUSI",
      };
      list = list.filter((s) => {
        if (!s._v2.cyclePosition) return false;
        for (const sel of siklusFilter) {
          if (cycleMap[sel] === s._v2.cyclePosition) return true;
        }
        return false;
      });
    }

    if (minScore > 0) list = list.filter((s) => s.readinessScore >= minScore);
    if (!sektorFilter.has("Semua")) list = list.filter((s) => s.sector && sektorFilter.has(s.sector));
    if (!flowFilter.has("Semua")) list = list.filter((s) => s._v2.flowBias && flowFilter.has(s._v2.flowBias));

    list.sort((a, b) => {
      if (sortKey === "score_desc") return b.readinessScore - a.readinessScore;
      if (sortKey === "score_asc") return a.readinessScore - b.readinessScore;
      if (sortKey === "name_az") return a.symbol.localeCompare(b.symbol);
      if (sortKey === "change_desc") return parseFloat(b.changePercent || "0") - parseFloat(a.changePercent || "0");
      return 0;
    });

    return list;
  }, [stocks, rezimFilter, siklusFilter, minScore, sektorFilter, flowFilter, sortKey]);

  function resetFilters() {
    setRezimFilter(new Set(["Semua"]));
    setSiklusFilter(new Set(["Semua"]));
    setMinScore(0);
    setSektorFilter(new Set(["Semua"]));
    setFlowFilter(new Set(["Semua"]));
    setSortKey("score_desc");
  }

  const totalStocks = stocks?.length ?? 0;

  return (
    <div className="px-6 py-6 min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* SECTION A — Header */}
      <div className="mb-5">
        <p
          className="text-[10px] tracking-[0.25em] uppercase mb-1.5"
          style={{ fontFamily: mono, color: "#38BDF8" }}
          data-testid="screener-label"
        >
          SCREENER
        </p>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: sora }} data-testid="screener-title">
          Filter Saham IDX
        </h1>
        <p className="text-sm mt-1" style={{ fontFamily: mono, color: "#6b7280" }}>
          Tentukan kriteria — BART menampilkan saham yang cocok
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 mt-6">
        {/* LEFT — Filter Panel */}
        <div
          className="h-fit lg:sticky lg:top-6 p-4 rounded-md"
          style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
          data-testid="screener-filter-panel"
        >
          <p className="text-sm font-bold text-white mb-4" style={{ fontFamily: sora }}>
            Filter Kriteria
          </p>

          <div className="mb-4">
            <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: mono, color: "#6b7280" }}>
              REZIM PASAR
            </p>
            <MultiPills
              options={["Semua", "Akumulasi", "Transisi", "Distribusi", "Volatile"]}
              selected={rezimFilter}
              onToggle={(v) => toggleMulti(rezimFilter, v, setRezimFilter)}
            />
          </div>

          <div className="mb-4">
            <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: mono, color: "#6b7280" }}>
              POSISI SIKLUS
            </p>
            <MultiPills
              options={["Semua", "Terlalu Dini", "Konfirmasi Mulai", "Entry Window", "Waspadai Distribusi"]}
              selected={siklusFilter}
              onToggle={(v) => toggleMulti(siklusFilter, v, setSiklusFilter)}
            />
          </div>

          <div className="mb-4">
            <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: mono, color: "#6b7280" }}>
              SKOR MINIMUM
            </p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#38BDF8]"
              data-testid="screener-slider-score"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>Min: {minScore}</span>
              <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>Maks: 100</span>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: mono, color: "#6b7280" }}>
              SEKTOR
            </p>
            <MultiPills
              options={["Semua", ...sectors]}
              selected={sektorFilter}
              onToggle={(v) => toggleMulti(sektorFilter, v, setSektorFilter)}
            />
          </div>

          <div className="mb-4">
            <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: mono, color: "#6b7280" }}>
              ALIRAN DANA
            </p>
            <MultiPills
              options={["Semua", "Akumulasi", "Netral", "Distribusi"]}
              selected={flowFilter}
              onToggle={(v) => toggleMulti(flowFilter, v, setFlowFilter)}
            />
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }} className="my-4" />

          <DisabledGroup label="LIKUIDITAS" options={["Semua", ">50B/hari", ">200B/hari", ">500B/hari"]} />
          <DisabledGroup label="VOLUME ANOMALI" options={["Semua", ">1.5× Rata-rata", ">2× Rata-rata", ">3× Rata-rata"]} />
          <DisabledGroup label="KAPITALISASI PASAR" options={["Semua", "Small Cap", "Mid Cap", "Large Cap"]} />

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={resetFilters}
              className="w-full py-2 rounded-md transition-all"
              style={{
                fontFamily: mono, fontSize: 10,
                background: "rgba(255,255,255,0.02)",
                color: "#6b7280",
                border: "1px solid #1F2937",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              data-testid="screener-reset"
            >
              Reset Filter
            </button>
            <p className="text-center text-[10px] mt-1" style={{ fontFamily: mono, color: "#6b7280" }}>
              {filtered.length} saham ditemukan dari {totalStocks} saham
            </p>
          </div>
        </div>

        {/* RIGHT — Results */}
        <div>
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
              Diurutkan berdasarkan:
            </span>
            <div className="flex gap-1.5">
              {([
                { key: "score_desc" as SortKey, label: "Skor ↓" },
                { key: "score_asc" as SortKey, label: "Skor ↑" },
                { key: "name_az" as SortKey, label: "Nama A–Z" },
                { key: "change_desc" as SortKey, label: "Perubahan ↓" },
              ]).map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortKey(s.key)}
                  className="px-3 py-1.5 rounded-md cursor-pointer transition-all duration-150"
                  style={pillStyle(sortKey === s.key)}
                  data-testid={`screener-sort-${s.key}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr style={{ background: "#0d0d0d", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  {["SAHAM", "SEKTOR", "HARGA", "SKOR", "SIKLUS", "ALIRAN", "AKSI"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3"
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        color: "#6B7280",
                        textTransform: "uppercase" as const,
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
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} style={{ background: "#161616", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 w-16 rounded bg-[#222] animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <p
                        className="text-sm mb-3"
                        style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)", letterSpacing: "0.15em" }}
                      >
                        [ TIDAK ADA HASIL ]
                      </p>
                      <p className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                        Coba ubah atau reset kriteria filter
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((stock) => {
                    const v2 = stock._v2;
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
                        data-testid={`screener-row-${stock.symbol}`}
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

                        {/* AKSI */}
                        <td className="px-4 py-3 w-32 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleWatchlist(stock.symbol); }}
                              className={`p-1.5 rounded-sm border transition-all duration-150 ${
                                watchlistedSymbols.has(stock.symbol)
                                  ? "border-amber-500/40 bg-amber-500/10 hover:border-amber-500/60 hover:bg-amber-500/20"
                                  : "border-[#ffffff10] bg-transparent hover:border-amber-500/30"
                              }`}
                              data-testid={`screener-star-${stock.symbol}`}
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
                                data-testid={`screener-detail-${stock.symbol}`}
                              >
                                ANALISIS →
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
        </div>
      </div>

      <p className="mt-8 text-center" style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.12)" }}>
        Filter likuiditas, volume, dan kapitalisasi akan aktif setelah integrasi data IDX live · PT Berkat Digital Investasi
      </p>
    </div>
  );
}

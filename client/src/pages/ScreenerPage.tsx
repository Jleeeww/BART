import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type SortKey = "score_desc" | "score_asc" | "name_az" | "change_desc";

interface Preset {
  id: string;
  label: string;
  description: string;
  minScore: number;
  rezimFilter: string[];
  siklusFilter: string[];
  flowFilter: string[];
  sektorFilter: string[];
}

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

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: Preset[] = [
  {
    id: "akumulasi_mature",
    label: "Akumulasi Mature",
    description: "Skor ≥60 + aliran positif",
    minScore: 60,
    rezimFilter: [],
    siklusFilter: [],
    flowFilter: ["Akumulasi"],
    sektorFilter: [],
  },
  {
    id: "entry_window",
    label: "Entry Window",
    description: "Siklus entry terkonfirmasi",
    minScore: 45,
    rezimFilter: [],
    siklusFilter: ["ENTRY_WINDOW", "KONFIRMASI_MULAI"],
    flowFilter: [],
    sektorFilter: [],
  },
  {
    id: "distribution_trap",
    label: "Jebakan Distribusi",
    description: "Waspada distribusi terdeteksi",
    minScore: 0,
    rezimFilter: ["Distribusi"],
    siklusFilter: ["WASPADAI_DISTRIBUSI"],
    flowFilter: ["Distribusi"],
    sektorFilter: [],
  },
  {
    id: "stealth_setup",
    label: "Stealth Setup",
    description: "Akumulasi dini, belum konfirmasi",
    minScore: 35,
    rezimFilter: [],
    siklusFilter: ["TERLALU_DINI"],
    flowFilter: ["Akumulasi"],
    sektorFilter: [],
  },
  {
    id: "sektor_keuangan",
    label: "Sektor Keuangan",
    description: "Bank + Asuransi + Fintech",
    minScore: 0,
    rezimFilter: [],
    siklusFilter: [],
    flowFilter: [],
    sektorFilter: ["Financials"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveV2(stock: StockData) {
  const score = stock.readinessScore ?? 0;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--border-2)"
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  );
}

function DecisionChip({ bucket }: { bucket: string }) {
  const map: Record<string, { label: string; color: string }> = {
    siap_dipantau: { label: "SIAP PANTAU", color: "var(--positive)" },
    watchlist_prioritas: { label: "WATCHLIST", color: "var(--warning)" },
    hindari_dulu: { label: "HINDARI", color: "var(--danger)" },
  };
  const { label, color } = map[bucket] ?? { label: bucket, color: "var(--text-3)" };
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 12,
        letterSpacing: "0.1em",
        color,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function FilterGroup({
  label,
  items,
  onSelect,
  activeValue,
  activeValues,
}: {
  label: string;
  items: string[];
  onSelect: (v: string) => void;
  activeValue?: string | null;
  activeValues?: string[];
}) {
  const active = activeValues ?? (activeValue ? [activeValue] : []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          fontFamily: mono,
          fontSize: 13,
          color: T4,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginRight: 2,
          whiteSpace: "nowrap",
        }}
      >
        {label}:
      </span>
      {items.map((item) => {
        const isActive = active.includes(item);
        return (
          <button
            key={item}
            onClick={() => onSelect(item)}
            style={{
              fontFamily: mono,
              fontSize: 12,
              padding: "4px 9px",
              borderRadius: 4,
              cursor: "pointer",
              background: isActive ? "rgba(79,195,247,0.1)" : "transparent",
              border: isActive ? "1px solid rgba(79,195,247,0.25)" : `1px solid ${B1}`,
              color: isActive ? SIGNAL : T4,
              transition: "all 0.12s",
              whiteSpace: "nowrap",
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function StockCard({
  stock,
  inWatchlist,
  onWatchlist,
}: {
  stock: StockData & { _v2: ReturnType<typeof deriveV2> };
  inWatchlist: boolean;
  onWatchlist: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = bucketAccent(stock.homepageBucket);
  const sColor = scoreColor(stock.readinessScore ?? 0);

  return (
    <div
      onClick={() => (window.location.href = `/dashboard/stock/${stock.symbol}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? S3 : S1,
        border: `1px solid ${hovered ? B2 : B1}`,
        borderTop: `2px solid ${accent}`,
        borderRadius: 10,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
      }}
      data-testid={`screener-row-${stock.symbol}`}
    >
      {/* Top row: symbol + watchlist */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: mono,
              fontSize: 16,
              fontWeight: 700,
              color: T1,
              marginBottom: 2,
              margin: "0 0 2px 0",
              letterSpacing: "-0.01em",
            }}
          >
            {stock.symbol}
          </p>
          <p
            style={{
              fontFamily: inter,
              fontSize: 13,
              color: T3,
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              margin: 0,
            }}
          >
            {stock.name}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onWatchlist();
          }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 4,
            cursor: "pointer",
            flexShrink: 0,
            background: inWatchlist ? "rgba(251,191,36,0.12)" : "transparent",
            border: inWatchlist ? "1px solid rgba(251,191,36,0.3)" : `1px solid ${B1}`,
            color: inWatchlist ? WARNING : T4,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.12s",
          }}
          data-testid={`screener-star-${stock.symbol}`}
        >
          ★
        </button>
      </div>

      {/* Score row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <MiniScoreRing score={stock.readinessScore ?? 0} size={44} />
        <div>
          <p
            style={{
              fontFamily: mono,
              fontSize: 22,
              fontWeight: 700,
              color: sColor,
              lineHeight: 1,
              marginBottom: 3,
              margin: "0 0 3px 0",
            }}
          >
            {stock.computeError ? "—" : stock.readinessScore}
          </p>
          <DecisionChip bucket={stock.homepageBucket} />
        </div>
      </div>

      {/* Score bar */}
      <div
        style={{
          height: 2,
          background: "var(--border-2)",
          borderRadius: 9999,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${stock.readinessScore ?? 0}%`,
            background: sColor,
            borderRadius: 9999,
            transition: "width 0.3s",
          }}
        />
      </div>

      {/* Sector + price row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.06em" }}>
          {stock.sector ?? "—"}
        </span>
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
              : "— 0.00%"}
        </span>
      </div>

      {/* Hover tooltip — AI sentence */}
      {hovered && stock.aiSentence && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--surface-4)",
            border: `1px solid ${B2}`,
            borderRadius: 8,
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          }}
        >
          <p style={{ fontFamily: inter, fontSize: 13, color: T2, lineHeight: 1.55, margin: 0 }}>
            {stock.aiSentence}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ScreenerPage() {
  // Filter state
  const [rezimFilter, setRezimFilter] = useState<Set<string>>(new Set());
  const [siklusFilter, setSiklusFilter] = useState<Set<string>>(new Set());
  const [minScore, setMinScore] = useState(0);
  const [sektorFilter, setSektorFilter] = useState<Set<string>>(new Set());
  const [flowFilter, setFlowFilter] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("score_desc");
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // API calls
  const { data: stocks, isLoading } = useQuery<StockData[]>({ queryKey: ["/api/stocks"] });
  const { data: watchlistData } = useQuery<WatchlistItem[]>({ queryKey: ["/api/watchlist"] });

  // watchlistedSymbols with optimistic overrides
  const watchlistedSymbols = useMemo(() => {
    const base = new Set(watchlistData?.map((w) => w.symbol) ?? []);
    for (const [sym, added] of Object.entries(optimisticOverrides)) {
      if (added) base.add(sym);
      else base.delete(sym);
    }
    return base;
  }, [watchlistData, optimisticOverrides]);

  // toggleWatchlist with rollback
  const toggleWatchlist = useCallback(
    async (symbol: string) => {
      const isStarred = watchlistedSymbols.has(symbol);
      setOptimisticOverrides((prev) => ({ ...prev, [symbol]: !isStarred }));
      try {
        if (isStarred) await apiRequest("DELETE", `/api/watchlist/${symbol}`);
        else await apiRequest("POST", `/api/watchlist/${symbol}`);
        queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      } catch {
        setOptimisticOverrides((prev) => ({ ...prev, [symbol]: isStarred }));
      }
    },
    [watchlistedSymbols],
  );

  // Filtering + sorting logic
  const filtered = useMemo(() => {
    if (!stocks) return [];
    let list = stocks.map((s) => ({ ...s, _v2: deriveV2(s) }));

    if (rezimFilter.size > 0) {
      list = list.filter((s) => {
        const r = s.marketRegime?.toLowerCase() || "";
        const fb = s._v2.flowBias;
        for (const sel of Array.from(rezimFilter)) {
          if (sel === "Akumulasi" && (r.includes("akumulasi") || fb === "Akumulasi")) return true;
          if (sel === "Distribusi" && (r.includes("distribusi") || fb === "Distribusi")) return true;
          if (sel === "Spekulatif" && r.includes("spekulatif")) return true;
          if (sel === "Fading" && (r.includes("fading") || r.includes("transisi"))) return true;
          if (sel === "Tidak Diketahui" && !r) return true;
        }
        return false;
      });
    }

    if (siklusFilter.size > 0) {
      list = list.filter((s) => {
        if (!s._v2.cyclePosition) return false;
        for (const sel of Array.from(siklusFilter)) {
          if (sel === s._v2.cyclePosition) return true;
        }
        return false;
      });
    }

    if (minScore > 0) list = list.filter((s) => (s.readinessScore ?? 0) >= minScore);
    if (sektorFilter.size > 0) list = list.filter((s) => s.sector && sektorFilter.has(s.sector));
    if (flowFilter.size > 0) list = list.filter((s) => s._v2.flowBias && flowFilter.has(s._v2.flowBias));

    list.sort((a, b) => {
      if (sortKey === "score_desc") return (b.readinessScore ?? -1) - (a.readinessScore ?? -1);
      if (sortKey === "score_asc") return (a.readinessScore ?? -1) - (b.readinessScore ?? -1);
      if (sortKey === "name_az") return a.symbol.localeCompare(b.symbol);
      if (sortKey === "change_desc")
        return parseFloat(b.changePercent || "0") - parseFloat(a.changePercent || "0");
      return 0;
    });

    return list;
  }, [stocks, rezimFilter, siklusFilter, minScore, sektorFilter, flowFilter, sortKey]);

  // Preset logic
  function applyPreset(preset: Preset) {
    if (activePreset === preset.id) {
      clearAllFilters();
      return;
    }
    setActivePreset(preset.id);
    setMinScore(preset.minScore);
    setRezimFilter(new Set(preset.rezimFilter));
    setSiklusFilter(new Set(preset.siklusFilter));
    setFlowFilter(new Set(preset.flowFilter));
    setSektorFilter(new Set(preset.sektorFilter));
  }

  function clearAllFilters() {
    setMinScore(0);
    setRezimFilter(new Set());
    setSiklusFilter(new Set());
    setFlowFilter(new Set());
    setSektorFilter(new Set());
    setActivePreset(null);
  }

  // Active chips derived from filter state
  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; color: string }[] = [];
    if (minScore > 0) chips.push({ id: "score", label: `Skor ≥ ${minScore}`, color: scoreColor(minScore) });
    for (const s of Array.from(siklusFilter)) {
      const labels: Record<string, string> = {
        ENTRY_WINDOW: "Entry Window",
        KONFIRMASI_MULAI: "Konfirmasi",
        TERLALU_DINI: "Terlalu Dini",
        WASPADAI_DISTRIBUSI: "Waspada Distribusi",
      };
      chips.push({ id: `siklus_${s}`, label: `Siklus: ${labels[s] ?? s}`, color: SIGNAL });
    }
    for (const f of Array.from(flowFilter))
      chips.push({
        id: `flow_${f}`,
        label: `Aliran: ${f}`,
        color: f === "Akumulasi" ? POSITIVE : f === "Distribusi" ? DANGER : T3,
      });
    for (const r of Array.from(rezimFilter))
      chips.push({ id: `rezim_${r}`, label: `Rezim: ${r}`, color: T2 });
    for (const sec of Array.from(sektorFilter))
      chips.push({ id: `sektor_${sec}`, label: `Sektor: ${sec}`, color: "#A78BFA" });
    return chips;
  }, [minScore, siklusFilter, flowFilter, rezimFilter, sektorFilter]);

  function removeChip(id: string) {
    if (id === "score") { setMinScore(0); return; }
    if (id.startsWith("siklus_")) {
      const k = id.replace("siklus_", "");
      setSiklusFilter((prev) => { const n = new Set(prev); n.delete(k); return n; });
      return;
    }
    if (id.startsWith("flow_")) {
      const k = id.replace("flow_", "");
      setFlowFilter((prev) => { const n = new Set(prev); n.delete(k); return n; });
      return;
    }
    if (id.startsWith("rezim_")) {
      const k = id.replace("rezim_", "");
      setRezimFilter((prev) => { const n = new Set(prev); n.delete(k); return n; });
      return;
    }
    if (id.startsWith("sektor_")) {
      const k = id.replace("sektor_", "");
      setSektorFilter((prev) => { const n = new Set(prev); n.delete(k); return n; });
      return;
    }
    setActivePreset(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: S0, paddingBottom: 80 }}>

      {/* ── HEADER + QUERY BAR ─────────────────────────────────────────────── */}
      <div style={{ padding: "24px 32px 0", maxWidth: 1400, margin: "0 auto" }}>

        {/* Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.2em",
                color: T4,
                textTransform: "uppercase",
                marginBottom: 6,
                margin: "0 0 6px 0",
              }}
              data-testid="screener-label"
            >
              SCREENER · IDX
            </p>
            <h1
              style={{
                fontFamily: inter,
                fontSize: 20,
                fontWeight: 600,
                color: T1,
                letterSpacing: "-0.02em",
                margin: 0,
              }}
              data-testid="screener-title"
            >
              Pemilihan Saham
            </h1>
          </div>
          <span
            style={{
              fontFamily: mono,
              fontSize: 13,
              color: POSITIVE,
              marginLeft: "auto",
            }}
          >
            {filtered.length} saham cocok
          </span>
        </div>

        {/* PRESET QUERIES */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontFamily: mono,
              fontSize: 13,
              letterSpacing: "0.14em",
              color: T4,
              textTransform: "uppercase",
              marginBottom: 8,
              margin: "0 0 8px 0",
            }}
          >
            KUERI TERSIMPAN
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  padding: "6px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background:
                    activePreset === preset.id ? "rgba(79,195,247,0.12)" : S1,
                  border:
                    activePreset === preset.id
                      ? "1px solid rgba(79,195,247,0.3)"
                      : `1px solid ${B1}`,
                  color: activePreset === preset.id ? SIGNAL : T3,
                  transition: "all 0.15s",
                }}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              style={{
                fontFamily: mono,
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 6,
                cursor: "pointer",
                background: "transparent",
                border: `1px solid ${B1}`,
                color: T4,
              }}
              data-testid="screener-reset"
            >
              Reset ×
            </button>
          </div>
        </div>

        {/* ACTIVE FILTER CHIPS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            background: S1,
            border: `1px solid ${B1}`,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            minHeight: 48,
          }}
          data-testid="screener-filter-panel"
        >
          {activeChips.length === 0 && (
            <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
              Semua saham · pilih kueri atau tambah filter di bawah
            </span>
          )}
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.04em",
                padding: "4px 10px",
                borderRadius: 4,
                background: chip.color + "18",
                border: `1px solid ${chip.color}40`,
                color: chip.color,
              }}
            >
              {chip.label}
              <button
                onClick={() => removeChip(chip.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: chip.color,
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                  fontSize: 13,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        {/* FILTER QUICK-ADD ROW */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Score filter */}
          <FilterGroup
            label="Skor >"
            items={["30", "45", "60", "75"]}
            onSelect={(v) => setMinScore(minScore === parseInt(v) ? 0 : parseInt(v))}
            activeValue={minScore > 0 ? String(minScore) : null}
          />

          {/* Siklus filter */}
          <FilterGroup
            label="Siklus"
            items={["Entry Window", "Konfirmasi", "Terlalu Dini", "Waspada"]}
            onSelect={(v) => {
              const map: Record<string, string> = {
                "Entry Window": "ENTRY_WINDOW",
                "Konfirmasi": "KONFIRMASI_MULAI",
                "Terlalu Dini": "TERLALU_DINI",
                "Waspada": "WASPADAI_DISTRIBUSI",
              };
              setSiklusFilter((prev) => {
                const n = new Set(prev);
                n.has(map[v]) ? n.delete(map[v]) : n.add(map[v]);
                return n;
              });
            }}
            activeValues={Array.from(siklusFilter).map(
              (k) =>
                Object.entries({
                  "Entry Window": "ENTRY_WINDOW",
                  "Konfirmasi": "KONFIRMASI_MULAI",
                  "Terlalu Dini": "TERLALU_DINI",
                  "Waspada": "WASPADAI_DISTRIBUSI",
                }).find(([, val]) => val === k)?.[0] ?? k,
            )}
          />

          {/* Aliran filter */}
          <FilterGroup
            label="Aliran"
            items={["Akumulasi", "Distribusi", "Netral"]}
            onSelect={(v) =>
              setFlowFilter((prev) => {
                const n = new Set(prev);
                n.has(v) ? n.delete(v) : n.add(v);
                return n;
              })
            }
            activeValues={Array.from(flowFilter)}
          />

          {/* Sort buttons */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: T4,
                letterSpacing: "0.1em",
              }}
            >
              URUT
            </span>
            {(["score_desc", "score_asc", "name_az", "change_desc"] as const).map((sk) => (
              <button
                key={sk}
                onClick={() => setSortKey(sk)}
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background:
                    sortKey === sk ? "rgba(79,195,247,0.1)" : "transparent",
                  border:
                    sortKey === sk
                      ? "1px solid rgba(79,195,247,0.3)"
                      : `1px solid ${B1}`,
                  color: sortKey === sk ? SIGNAL : T3,
                }}
                data-testid={`screener-sort-${sk}`}
              >
                {sk === "score_desc"
                  ? "Skor ↓"
                  : sk === "score_asc"
                    ? "Skor ↑"
                    : sk === "name_az"
                      ? "A–Z"
                      : "Perubahan ↓"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CARD GRID RESULTS ──────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px 40px" }}>
        {isLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 180,
                  background: S1,
                  borderRadius: 10,
                  border: `1px solid ${B1}`,
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 32px" }}>
            <p
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: T4,
                letterSpacing: "0.15em",
                marginBottom: 8,
                margin: "0 0 8px 0",
              }}
            >
              [ TIDAK ADA HASIL ]
            </p>
            <p style={{ fontFamily: inter, fontSize: 13, color: T4, margin: 0 }}>
              Coba reset filter atau ubah parameter
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {filtered.map((stock) => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                inWatchlist={watchlistedSymbols.has(stock.symbol)}
                onWatchlist={() => toggleWatchlist(stock.symbol)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

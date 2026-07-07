import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { NewsGrid } from "@/components/NewsGrid";
import { NewsArticleCard } from "@/components/v3/NewsArticleCard";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";
const S0 = "var(--surface-0)"; const S1 = "var(--surface-1)"; const S2 = "var(--surface-2)"; const S3 = "var(--surface-3)";
const B1 = "var(--border-2)";
const T1 = "var(--text-1)"; const T2 = "var(--text-2)"; const T3 = "var(--text-3)"; const T4 = "var(--text-4)";
const SIGNAL = "var(--signal)"; const POSITIVE = "var(--positive)"; const WARNING = "var(--warning)"; const DANGER = "var(--danger)";

type Filter = "semua" | "hari_ini" | "critical" | "high";
type ViewMode = "stream" | "dampak" | "sektor";

interface FeedItem {
  id: string; title: string; summary: string; source: string;
  url: string; publishedAt: string; analyzed: boolean;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  direction?: "POSITIF" | "NEGATIF" | "NETRAL";
  mechanism?: string;
  affectedSymbols?: { symbol: string; direction: string; strength: string }[];
  affectedSectors?: { name: string; direction: string }[];
}

interface FeedData {
  feed: FeedItem[];
  stats: { totalAnalyzed: number; freshAnalyzed: number; criticalAlerts: number; highAlerts: number; };
  total: number;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
}

const PILLS: { id: Filter; label: string }[] = [
  { id: "semua",    label: "Semua" },
  { id: "hari_ini", label: "Hari Ini" },
  { id: "critical", label: "CRITICAL" },
  { id: "high",     label: "HIGH" },
];

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: "stream",  label: "STREAM" },
  { id: "dampak",  label: "DAMPAK" },
  { id: "sektor",  label: "SEKTOR" },
];

const SEVERITIES: Array<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW"> = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function severityColor(sev: string): { fg: string; bg: string; border: string } {
  if (sev === "CRITICAL") return { fg: DANGER,   bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)" };
  if (sev === "HIGH")     return { fg: WARNING,  bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)" };
  if (sev === "MEDIUM")   return { fg: SIGNAL,   bg: "rgba(79,195,247,0.1)",   border: "rgba(79,195,247,0.25)" };
  return                         { fg: T3,       bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.2)" };
}

function directionColor(dir: string): string {
  if (dir === "POSITIF") return POSITIVE;
  if (dir === "NEGATIF") return DANGER;
  return T3;
}

export default function BeritaPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("semua");
  const [viewMode, setViewMode] = useState<ViewMode>("stream");
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/news")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const allItems = data?.feed ?? [];

  const filtered = useMemo(() => {
    let items = allItems.filter((item) => {
      if (filter === "hari_ini") return isToday(item.publishedAt);
      if (filter === "critical") return item.severity === "CRITICAL";
      if (filter === "high")     return item.severity === "HIGH" || item.severity === "CRITICAL";
      return true;
    });
    if (viewMode === "stream" && sectorFilter) {
      items = items.filter((item) =>
        item.affectedSectors?.some((s) => s.name === sectorFilter) ?? false
      );
    }
    return items;
  }, [allItems, filter, viewMode, sectorFilter]);

  function emptyMessage(): { title: string; sub: string } {
    if (filter === "critical") return {
      title: "Tidak ada berita kritis aktif saat ini.",
      sub: "Berita CRITICAL ditandai ketika ada dampak langsung dan signifikan terhadap pasar atau emiten.",
    };
    if (filter === "high") return {
      title: "Tidak ada berita penting aktif saat ini.",
      sub: "Berita HIGH/CRITICAL muncul saat ada event dengan dampak nyata ke saham atau sektor IDX.",
    };
    if (filter === "hari_ini") return {
      title: "Belum ada berita hari ini.",
      sub: "Pipeline berita aktif setiap 15 menit. Coba lagi sebentar.",
    };
    return {
      title: "Belum ada artikel dalam cache.",
      sub: "Pipeline berita aktif setiap 15 menit. Coba lagi sebentar.",
    };
  }

  const criticalCount = allItems.filter((i) => i.severity === "CRITICAL").length;
  const highCount = allItems.filter((i) => i.severity === "HIGH" || i.severity === "CRITICAL").length;

  // --- Dampak view: group by severity ---
  const groupedBySeverity = useMemo(() => {
    const map: Record<string, FeedItem[]> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
    for (const item of filtered) {
      const key = item.severity ?? "LOW";
      if (map[key]) map[key].push(item);
      else map["LOW"].push(item);
    }
    return map;
  }, [filtered]);

  // --- Dampak right rail: affected symbols ---
  const topSymbols = useMemo(() => {
    const counts: Record<string, { count: number; directions: string[] }> = {};
    for (const item of filtered) {
      for (const sym of item.affectedSymbols ?? []) {
        if (!counts[sym.symbol]) counts[sym.symbol] = { count: 0, directions: [] };
        counts[sym.symbol].count++;
        counts[sym.symbol].directions.push(sym.direction);
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([symbol, { count, directions }]) => {
        const tally: Record<string, number> = {};
        for (const d of directions) tally[d] = (tally[d] ?? 0) + 1;
        const majority = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NETRAL";
        return { symbol, count, direction: majority };
      });
  }, [filtered]);

  // --- Dampak right rail: affected sectors ---
  const topSectors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filtered) {
      const seen = new Set<string>();
      for (const sec of item.affectedSectors ?? []) {
        if (!seen.has(sec.name)) {
          counts[sec.name] = (counts[sec.name] ?? 0) + 1;
          seen.add(sec.name);
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [filtered]);

  // --- Sektor view: sector matrix ---
  const sectorMatrix = useMemo(() => {
    const map: Record<string, { positive: number; negative: number; neutral: number; articles: FeedItem[] }> = {};
    for (const item of filtered) {
      const seenInItem = new Set<string>();
      for (const sec of item.affectedSectors ?? []) {
        if (seenInItem.has(sec.name)) continue;
        seenInItem.add(sec.name);
        if (!map[sec.name]) map[sec.name] = { positive: 0, negative: 0, neutral: 0, articles: [] };
        if (sec.direction === "POSITIF") map[sec.name].positive++;
        else if (sec.direction === "NEGATIF") map[sec.name].negative++;
        else map[sec.name].neutral++;
        map[sec.name].articles.push(item);
      }
    }
    return Object.entries(map).sort((a, b) => b[1].articles.length - a[1].articles.length);
  }, [filtered]);

  // --- Skeleton loader ---
  const skeletons = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          height: 90, background: S1,
          border: "1px solid var(--border-1)",
          borderRadius: 8,
        }} />
      ))}
    </div>
  );

  // --- Empty state ---
  const emptyState = (
    <div style={{
      background: S1, border: "1px solid var(--border-1)",
      borderRadius: 10, padding: "48px 32px", textAlign: "center",
    }}>
      <p style={{ fontFamily: mono, fontSize: 13, color: T4, marginBottom: 8 }}>
        {emptyMessage().title}
      </p>
      <p style={{ fontFamily: inter, fontSize: 12, color: "var(--text-4)", lineHeight: 1.6 }}>
        {emptyMessage().sub}
      </p>
    </div>
  );

  // --- Article list ---
  const articleList = (items: FeedItem[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item) => (
        <NewsArticleCard
          key={item.id}
          title={item.title}
          summary={item.summary}
          source={item.source}
          publishedAt={item.publishedAt}
          url={item.url || undefined}
          direction={item.direction}
          analyzed={item.analyzed}
          severity={item.severity}
          mechanism={item.mechanism}
          affectedSymbols={item.affectedSymbols}
          affectedSectors={item.affectedSectors}
          onSymbolClick={(sym) => setLocation(`/stock/${sym}`)}
        />
      ))}
    </div>
  );

  // --- Right rail section heading ---
  const railHeading = (label: string) => (
    <p style={{
      fontFamily: mono, fontSize: 13, letterSpacing: "0.14em",
      color: T4, textTransform: "uppercase", marginBottom: 10,
    }}>
      {label}
    </p>
  );

  // --- Right rail for dampak view ---
  const dampakRail = (
    <div style={{
      position: "sticky", top: 132,
      display: "flex", flexDirection: "column", gap: 24,
    }}>
      {/* Affected symbols */}
      <div>
        {railHeading("Entitas Terdampak")}
        {loading ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4 }}>[ MEMUAT... ]</p>
        ) : topSymbols.length === 0 ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4 }}>[ TIDAK ADA DATA ]</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topSymbols.map(({ symbol, count, direction }) => {
              const dColor = directionColor(direction);
              return (
                <button
                  key={symbol}
                  onClick={() => setLocation(`/stock/${symbol}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "var(--border-1)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 6, padding: "6px 10px",
                    cursor: "pointer", width: "100%",
                    transition: "border-color 0.1s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${dColor}40`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: dColor, boxShadow: `0 0 4px ${dColor}60`,
                    }} />
                    <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: T1 }}>
                      {symbol}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 13, color: dColor }}>
                      {direction}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: mono, fontSize: 13, color: T4,
                    background: "var(--border-1)",
                    border: "1px solid var(--border-2)",
                    borderRadius: 4, padding: "1px 5px",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Affected sectors */}
      <div>
        {railHeading("Sektor Terdampak")}
        {loading ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4 }}>[ MEMUAT... ]</p>
        ) : topSectors.length === 0 ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4 }}>[ TIDAK ADA DATA ]</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {topSectors.map(({ name, count }) => (
              <span
                key={name}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: mono, fontSize: 13, color: T3,
                  background: "var(--border-1)",
                  border: "1px solid var(--border-2)",
                  borderRadius: 4, padding: "3px 8px",
                }}
              >
                {name}
                <span style={{
                  fontFamily: mono, fontSize: 12, color: T4,
                  background: "var(--border-2)",
                  borderRadius: 3, padding: "1px 4px",
                }}>
                  {count}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // --- Sektor grid ---
  const sektorView = (
    <div>
      {sectorFilter && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: T3 }}>
            Filter aktif: <span style={{ color: SIGNAL }}>{sectorFilter}</span>
          </span>
          <button
            onClick={() => setSectorFilter(null)}
            style={{
              fontFamily: mono, fontSize: 13, color: DANGER,
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: 4, padding: "2px 8px", cursor: "pointer",
            }}
          >
            HAPUS FILTER
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 110, background: S1,
              border: "1px solid var(--border-1)",
              borderRadius: 8,
            }} />
          ))}
        </div>
      ) : sectorMatrix.length === 0 ? (
        <div style={{
          background: S1, border: "1px solid var(--border-1)",
          borderRadius: 10, padding: "48px 32px", textAlign: "center",
        }}>
          <p style={{ fontFamily: mono, fontSize: 13, color: T4 }}>
            [ TIDAK ADA DATA SEKTOR ]
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {sectorMatrix.map(([name, { positive, negative, neutral, articles }]) => {
            const total = positive + negative + neutral || 1;
            const posW = Math.round((positive / total) * 100);
            const negW = Math.round((negative / total) * 100);
            const neuW = 100 - posW - negW;
            const dominantDir = positive > negative
              ? "POSITIF"
              : negative > positive
              ? "NEGATIF"
              : "NETRAL";
            const dColor = directionColor(dominantDir);

            return (
              <button
                key={name}
                onClick={() => {
                  setSectorFilter(name);
                  setViewMode("stream");
                }}
                style={{
                  background: S1,
                  border: "1px solid var(--border-2)",
                  borderRadius: 8, padding: "14px 16px",
                  cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.1s",
                  display: "flex", flexDirection: "column", gap: 10,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${dColor}40`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-2)"; }}
              >
                {/* Sector name + direction */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: inter, fontSize: 13, fontWeight: 500, color: T1, lineHeight: 1.4 }}>
                    {name}
                  </span>
                  <span style={{
                    fontFamily: mono, fontSize: 13, color: dColor,
                    background: `${dColor}12`, border: `1px solid ${dColor}30`,
                    borderRadius: 3, padding: "2px 6px", flexShrink: 0,
                  }}>
                    {dominantDir}
                  </span>
                </div>

                {/* Mini bar */}
                <div style={{
                  display: "flex", height: 4, borderRadius: 2, overflow: "hidden",
                  background: "var(--border-1)",
                }}>
                  {posW > 0 && (
                    <div style={{ width: `${posW}%`, background: POSITIVE, opacity: 0.8 }} />
                  )}
                  {negW > 0 && (
                    <div style={{ width: `${negW}%`, background: DANGER, opacity: 0.8 }} />
                  )}
                  {neuW > 0 && (
                    <div style={{ width: `${neuW}%`, background: "rgba(113,113,122,0.3)" }} />
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: mono, fontSize: 13, color: T4 }}>
                    {articles.length} artikel
                  </span>
                  {positive > 0 && (
                    <span style={{ fontFamily: mono, fontSize: 13, color: POSITIVE }}>
                      +{positive}
                    </span>
                  )}
                  {negative > 0 && (
                    <span style={{ fontFamily: mono, fontSize: 13, color: DANGER }}>
                      -{negative}
                    </span>
                  )}
                  {neutral > 0 && (
                    <span style={{ fontFamily: mono, fontSize: 13, color: T4 }}>
                      {neutral}N
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: S0, paddingBottom: 60 }}>
      {/* Zone A — Sticky Header */}
      <div style={{
        borderBottom: "1px solid var(--border-1)",
        padding: "28px 32px 0",
        background: S0,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: viewMode === "dampak" ? 1100 : 860, margin: "0 auto" }}>
          {/* Top row: title + live */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <p style={{
                fontFamily: mono, fontSize: 12, letterSpacing: "0.14em",
                color: T4, marginBottom: 6, textTransform: "uppercase",
              }}>
                MARKET INTELLIGENCE
              </p>
              <h1 style={{
                fontFamily: mono, fontSize: 20, fontWeight: 600,
                color: T1, letterSpacing: "-0.01em",
              }}>
                Pipeline Berita
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: POSITIVE, boxShadow: "0 0 5px rgba(74,222,128,0.6)",
              }} />
              <span style={{ fontFamily: mono, fontSize: 12, color: POSITIVE, letterSpacing: "0.08em" }}>LIVE</span>
              {data?.stats && (
                <span style={{ fontFamily: mono, fontSize: 12, color: T4, marginLeft: 8 }}>
                  {data.total} artikel · {criticalCount} kritis · {highCount} penting
                </span>
              )}
            </div>
          </div>

          {/* Row 1: Filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 0 }}>
            {PILLS.map((pill) => {
              const active = filter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setFilter(pill.id)}
                  style={{
                    fontFamily: mono, fontSize: 12, letterSpacing: "0.1em",
                    padding: "5px 12px", borderRadius: 9999, cursor: "pointer",
                    background: active ? "rgba(79,195,247,0.12)" : "var(--border-1)",
                    border: active ? "1px solid rgba(79,195,247,0.3)" : "1px solid var(--border-2)",
                    color: active ? SIGNAL : T3,
                    transition: "all 0.1s",
                    textTransform: "uppercase",
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          {/* Row 2: View mode toggles */}
          <div style={{ display: "flex", gap: 0, marginTop: 12 }}>
            {VIEW_MODES.map((vm) => {
              const active = viewMode === vm.id;
              return (
                <button
                  key={vm.id}
                  onClick={() => {
                    setViewMode(vm.id);
                    if (vm.id !== "stream") setSectorFilter(null);
                  }}
                  style={{
                    fontFamily: mono, fontSize: 12, letterSpacing: "0.12em",
                    padding: "8px 14px", cursor: "pointer",
                    background: "transparent", border: "none",
                    borderBottom: active ? `2px solid ${SIGNAL}` : "2px solid transparent",
                    color: active ? SIGNAL : T4,
                    transition: "all 0.1s",
                  }}
                >
                  {vm.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zone B0 — Real market news grid (with images, no AI) */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 32px 0" }}>
        <NewsGrid limit={12} />
      </div>

      {/* Zone B — Main content */}
      <div style={{
        maxWidth: viewMode === "dampak" ? 1100 : 860,
        margin: "0 auto",
        padding: "20px 32px",
      }}>

        {/* STREAM VIEW */}
        {viewMode === "stream" && (
          <div>
            {sectorFilter && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: T3 }}>
                  Filter sektor: <span style={{ color: SIGNAL }}>{sectorFilter}</span>
                </span>
                <button
                  onClick={() => setSectorFilter(null)}
                  style={{
                    fontFamily: mono, fontSize: 13, color: DANGER,
                    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
                    borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                  }}
                >
                  HAPUS FILTER
                </button>
              </div>
            )}
            {loading ? skeletons : filtered.length === 0 ? emptyState : articleList(filtered)}
          </div>
        )}

        {/* DAMPAK VIEW */}
        {viewMode === "dampak" && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Left panel: grouped by severity */}
            <div style={{ flex: "0 0 65%", minWidth: 0 }}>
              {loading ? skeletons : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {SEVERITIES.map((sev) => {
                    const items = groupedBySeverity[sev] ?? [];
                    if (items.length === 0) return null;
                    const sevStyle = severityColor(sev);
                    return (
                      <div key={sev}>
                        {/* Group header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{
                            fontFamily: mono, fontSize: 12, fontWeight: 700,
                            letterSpacing: "0.1em", color: sevStyle.fg,
                            background: sevStyle.bg, border: `1px solid ${sevStyle.border}`,
                            borderRadius: 4, padding: "3px 8px",
                          }}>
                            {sev}
                          </span>
                          <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
                            — {items.length} artikel
                          </span>
                          <div style={{ flex: 1, height: 1, background: "var(--border-1)" }} />
                        </div>
                        {articleList(items)}
                      </div>
                    );
                  })}
                  {SEVERITIES.every((sev) => (groupedBySeverity[sev] ?? []).length === 0) && emptyState}
                </div>
              )}
            </div>

            {/* Right panel: rail */}
            <div style={{ flex: "0 0 calc(35% - 24px)", minWidth: 0 }}>
              {dampakRail}
            </div>
          </div>
        )}

        {/* SEKTOR VIEW */}
        {viewMode === "sektor" && sektorView}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  Radio,
  Star,
  SlidersHorizontal,
  BarChart2,
  Newspaper,
  Settings,
  Search,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

// ── Nav structure ─────────────────────────────────────────────────────────────
type NavItem = {
  icon: React.ElementType;
  label: string;
  route: string;
  exact?: boolean;
  locked?: boolean;
  badge?: string;
};
type Section = { label: string; items: NavItem[] };

const NAV_SECTIONS: Section[] = [
  {
    label: "WORKFLOW",
    items: [
      { icon: LayoutGrid, label: "Beranda",   route: "/",          exact: true },
      { icon: Radio,       label: "Radar",     route: "/radar"      },
      { icon: Star,        label: "Watchlist", route: "/watchlist"  },
      { icon: SlidersHorizontal, label: "Screener", route: "/screener" },
    ],
  },
  {
    label: "MARKET",
    items: [
      { icon: BarChart2,  label: "Pasar",  route: "/pasar"  },
      { icon: Newspaper,  label: "Berita", route: "/berita", badge: "NEW" },
    ],
  },
  {
    label: "PRO",
    items: [
      { icon: Settings, label: "Pengaturan", route: "/pengaturan", locked: true },
    ],
  },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useMarketStatus() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function check() {
      const wib = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const day = wib.getDay();
      const mins = wib.getHours() * 60 + wib.getMinutes();
      setOpen(day >= 1 && day <= 5 && mins >= 540 && mins < 900);
    }
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

function useWibClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ── Search types ──────────────────────────────────────────────────────────────
interface SearchResult {
  symbol: string;
  companyName: string;
  price: string;
  changePercent: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const marketOpen = useMarketStatus();
  const wibTime = useWibClock();

  const W = collapsed ? 56 : 200;

  function isActive(route: string, exact?: boolean) {
    if (exact) return location === route || location.startsWith("/stock/");
    return location.startsWith(route);
  }

  // Search debounce
  useEffect(() => {
    if (query.length < 1) { setResults([]); setDropOpen(false); return; }
    setIsLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setDropOpen(true);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleResultClick(symbol: string) {
    setQuery(""); setDropOpen(false); setResults([]);
    setLocation(`/stock/${symbol}`);
  }

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-200"
      style={{
        width: W,
        background: "#000000",
        borderRight: "1px solid rgba(255,255,255,0.04)",
      }}
      data-testid="sidebar"
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Link href="/">
        <div
          className="flex items-center cursor-pointer overflow-hidden"
          style={{
            height: 56,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            paddingLeft: collapsed ? 0 : 18,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <span style={{
            fontFamily: mono, fontWeight: 700, fontSize: 14,
            letterSpacing: "0.16em", color: "#4FC3F7",
          }}>
            {collapsed ? "B" : "BART"}
          </span>
        </div>
      </Link>

      {/* ── Search ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div
          ref={searchRef}
          style={{ padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", position: "relative" }}
        >
          <div style={{ position: "relative" }}>
            <Search style={{
              position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
              width: 11, height: 11, color: "rgba(255,255,255,0.18)", pointerEvents: "none",
            }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari saham..."
              style={{
                fontFamily: mono, fontSize: 11,
                width: "100%", borderRadius: 6,
                paddingLeft: 28, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#F4F4F5",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(79,195,247,0.35)";
                e.currentTarget.style.background = "#0f0f0f";
                if (results.length > 0) setDropOpen(true);
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.background = "#0a0a0a";
              }}
              data-testid="input-search-stock"
            />
          </div>

          {dropOpen && (
            <div style={{
              position: "absolute", left: 10, right: 10, marginTop: 4, zIndex: 50,
              borderRadius: 6, overflow: "hidden auto",
              background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)",
              maxHeight: 256,
            }}>
              {isLoading ? (
                <p style={{ fontFamily: mono, fontSize: 10, color: "rgba(79,195,247,0.5)", textAlign: "center", padding: "14px 0" }}>
                  Memindai...
                </p>
              ) : results.length === 0 ? (
                <p style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.18)", textAlign: "center", padding: "14px 0" }}>
                  Saham tidak ditemukan
                </p>
              ) : results.map((r, i) => (
                <div
                  key={r.symbol}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", cursor: "pointer",
                    borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(79,195,247,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  onMouseDown={() => handleResultClick(r.symbol)}
                  data-testid={`search-result-${r.symbol}`}
                >
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "#F4F4F5", flexShrink: 0, width: 48 }}>
                    {r.symbol}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#71717A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.companyName}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "#A1A1AA", flexShrink: 0 }}>
                    {r.price}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8, overflowY: "auto" }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} style={{ marginTop: si > 0 ? 8 : 0 }}>
            {/* Section label */}
            {!collapsed && (
              <div style={{
                padding: "6px 18px 4px",
                fontFamily: mono, fontSize: 9,
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.2)",
                textTransform: "uppercase",
              }}>
                {section.label}
              </div>
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              const active = !item.locked && isActive(item.route, item.exact);

              if (item.locked) {
                return (
                  <div
                    key={item.route}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      paddingLeft: collapsed ? 0 : 18, paddingRight: 10,
                      paddingTop: 8, paddingBottom: 8,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: "rgba(255,255,255,0.14)",
                      cursor: "not-allowed",
                    }}
                  >
                    <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    {!collapsed && (
                      <>
                        <span style={{ fontFamily: mono, fontSize: 12, flex: 1 }}>{item.label}</span>
                        <span style={{
                          fontFamily: mono, fontSize: 8, color: "rgba(255,255,255,0.14)",
                          background: "rgba(255,255,255,0.03)", borderRadius: 3,
                          padding: "1px 5px",
                        }}>
                          Segera
                        </span>
                      </>
                    )}
                  </div>
                );
              }

              return (
                <Link key={item.route} href={item.route}>
                  <div
                    title={collapsed ? item.label : undefined}
                    style={{
                      position: "relative",
                      display: "flex", alignItems: "center", gap: 10,
                      paddingLeft: collapsed ? 0 : 18, paddingRight: 10,
                      paddingTop: 8, paddingBottom: 8,
                      justifyContent: collapsed ? "center" : "flex-start",
                      cursor: "pointer",
                      background: active ? "rgba(79,195,247,0.08)" : "transparent",
                      color: active ? "#4FC3F7" : "#71717A",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "#141414";
                        e.currentTarget.style.color = "#F4F4F5";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#71717A";
                      }
                    }}
                  >
                    {/* Active left bar */}
                    {active && (
                      <div style={{
                        position: "absolute", left: 0,
                        top: "20%", bottom: "20%",
                        width: 2, borderRadius: "0 1px 1px 0",
                        background: "#4FC3F7",
                      }} />
                    )}
                    <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                    {!collapsed && (
                      <span style={{
                        fontFamily: mono, fontSize: 12,
                        fontWeight: active ? 500 : 400,
                        flex: 1,
                      }}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span style={{
                        fontFamily: mono, fontSize: 8, fontWeight: 600,
                        color: "#4FC3F7",
                        background: "rgba(79,195,247,0.12)",
                        border: "1px solid rgba(79,195,247,0.25)",
                        borderRadius: 3, padding: "1px 5px", flexShrink: 0,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Toggle ───────────────────────────────────────────────────── */}
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "10px 0",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.2)",
          cursor: "pointer", background: "transparent", border: "none",
          width: "100%",
          transition: "color 0.1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}
        data-testid="button-toggle-sidebar"
        title={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
        aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
      >
        {collapsed
          ? <ChevronsRight style={{ width: 13, height: 13 }} />
          : <ChevronsLeft  style={{ width: 13, height: 13 }} />}
      </button>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: "10px 18px 14px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: marketOpen ? "#4ADE80" : "#3F3F46",
                boxShadow: marketOpen ? "0 0 5px rgba(74,222,128,0.6)" : "none",
              }} />
              <span style={{
                fontFamily: mono, fontSize: 9, letterSpacing: "0.08em",
                color: marketOpen ? "#4ADE80" : "#3F3F46",
              }}>
                {marketOpen ? "BUKA" : "TUTUP"}
              </span>
            </div>
            {wibTime && (
              <span style={{ fontFamily: mono, fontSize: 9, color: "#3F3F46", letterSpacing: "0.06em" }}>
                {wibTime} WIB
              </span>
            )}
          </div>
          <p style={{ fontFamily: mono, fontSize: 9, color: "rgba(255,255,255,0.1)", letterSpacing: "0.06em" }}>
            BART v3.0 · IDX
          </p>
        </div>
      )}
    </aside>
  );
}

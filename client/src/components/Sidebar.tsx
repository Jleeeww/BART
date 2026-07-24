import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  Radio,
  Star,
  SlidersHorizontal,
  BarChart2,
  Newspaper,
  Sparkles,
  SlidersVertical,
  Settings,
  Search,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  Lock,
  LogOut,
  Users,
  MessageSquare,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

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
type Section = { label: string; items: NavItem[]; adminOnly?: boolean };

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
      { icon: Sparkles,   label: "Tema Pasar", route: "/tema", badge: "AI" },
      { icon: MessageSquare, label: "Chat BART", route: "/chat", badge: "AI" },
    ],
  },
  {
    label: "ADMIN",
    adminOnly: true,
    items: [
      { icon: Users, label: "Pengguna", route: "/admin/users" },
      { icon: SlidersVertical, label: "Konfigurasi", route: "/admin/config" },
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
  const { theme, toggleTheme } = useTheme();
  const { user, isUnlocked, logout } = useAuth();

  const visibleSections = NAV_SECTIONS.filter(
    (s) => !s.adminOnly || user?.role === "admin"
  );

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
        background: "var(--surface-0)",
        borderRight: "1px solid var(--border-1)",
      }}
      data-testid="sidebar"
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Link href="/">
        <div
          className="flex items-center cursor-pointer overflow-hidden"
          style={{
            height: 56,
            borderBottom: "1px solid var(--border-1)",
            paddingLeft: collapsed ? 0 : 18,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <span style={{
            fontFamily: mono, fontWeight: 700, fontSize: 15,
            letterSpacing: "0.16em", color: "var(--signal)",
          }}>
            {collapsed ? "B" : "BART"}
          </span>
        </div>
      </Link>

      {/* ── Search (hidden while account is locked) ──────────────────── */}
      {!collapsed && isUnlocked && (
        <div
          ref={searchRef}
          style={{ padding: "10px 10px", borderBottom: "1px solid var(--border-1)", position: "relative" }}
        >
          <div style={{ position: "relative" }}>
            <Search style={{
              position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
              width: 13, height: 13, color: "var(--text-4)", pointerEvents: "none",
            }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari saham..."
              style={{
                fontFamily: mono, fontSize: 13,
                width: "100%", borderRadius: 6,
                paddingLeft: 30, paddingRight: 8, paddingTop: 7, paddingBottom: 7,
                background: "var(--surface-1)",
                border: "1px solid var(--border-2)",
                color: "var(--text-1)",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--signal)";
                e.currentTarget.style.background = "var(--surface-2)";
                if (results.length > 0) setDropOpen(true);
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-2)";
                e.currentTarget.style.background = "var(--surface-1)";
              }}
              data-testid="input-search-stock"
            />
          </div>

          {dropOpen && (
            <div style={{
              position: "absolute", left: 10, right: 10, marginTop: 4, zIndex: 50,
              borderRadius: 6, overflow: "hidden auto",
              background: "var(--surface-1)", border: "1px solid var(--border-2)",
              maxHeight: 256,
            }}>
              {isLoading ? (
                <p style={{ fontFamily: mono, fontSize: 12, color: "var(--signal)", textAlign: "center", padding: "14px 0" }}>
                  Memindai...
                </p>
              ) : results.length === 0 ? (
                <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)", textAlign: "center", padding: "14px 0" }}>
                  Saham tidak ditemukan
                </p>
              ) : results.map((r, i) => (
                <div
                  key={r.symbol}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", cursor: "pointer",
                    borderBottom: i < results.length - 1 ? "1px solid var(--border-1)" : "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--signal-dim)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  onMouseDown={() => handleResultClick(r.symbol)}
                  data-testid={`search-result-${r.symbol}`}
                >
                  <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "var(--text-1)", flexShrink: 0, width: 48 }}>
                    {r.symbol}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.companyName}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-2)", flexShrink: 0 }}>
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
        {visibleSections.map((section, si) => (
          <div key={section.label} style={{ marginTop: si > 0 ? 8 : 0 }}>
            {/* Section label */}
            {!collapsed && (
              <div style={{
                padding: "6px 18px 4px",
                fontFamily: mono, fontSize: 10,
                letterSpacing: "0.14em",
                color: "var(--text-4)",
                textTransform: "uppercase",
              }}>
                {section.label}
              </div>
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              // Pending (unapproved) accounts see every feature locked.
              const lockedItem = item.locked || !isUnlocked;
              const active = !lockedItem && isActive(item.route, item.exact);

              if (lockedItem) {
                return (
                  <div
                    key={item.route}
                    title={collapsed ? item.label : !item.locked ? "Menunggu persetujuan admin" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      paddingLeft: collapsed ? 0 : 18, paddingRight: 10,
                      paddingTop: 8, paddingBottom: 8,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: "var(--text-4)",
                      cursor: "not-allowed",
                    }}
                  >
                    <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                    {!collapsed && (
                      <>
                        <span style={{ fontFamily: mono, fontSize: 13, flex: 1 }}>{item.label}</span>
                        {item.locked ? (
                          <span style={{
                            fontFamily: mono, fontSize: 10, color: "var(--text-4)",
                            background: "var(--surface-2)", borderRadius: 3,
                            padding: "1px 5px",
                          }}>
                            Segera
                          </span>
                        ) : (
                          <Lock style={{ width: 12, height: 12, flexShrink: 0 }} />
                        )}
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
                      background: active ? "var(--signal-dim)" : "transparent",
                      color: active ? "var(--signal)" : "var(--text-3)",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "var(--surface-3)";
                        e.currentTarget.style.color = "var(--text-1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-3)";
                      }
                    }}
                  >
                    {/* Active left bar */}
                    {active && (
                      <div style={{
                        position: "absolute", left: 0,
                        top: "20%", bottom: "20%",
                        width: 2, borderRadius: "0 1px 1px 0",
                        background: "var(--signal)",
                      }} />
                    )}
                    <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                    {!collapsed && (
                      <span style={{
                        fontFamily: mono, fontSize: 13,
                        fontWeight: active ? 500 : 400,
                        flex: 1,
                      }}>
                        {item.label}
                      </span>
                    )}
                    {!collapsed && item.badge && (
                      <span style={{
                        fontFamily: mono, fontSize: 10, fontWeight: 600,
                        color: "var(--signal)",
                        background: "var(--signal-dim)",
                        border: "1px solid var(--signal)",
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

      {/* ── User + logout ────────────────────────────────────────────── */}
      {user && (
        <div style={{
          borderTop: "1px solid var(--border-1)",
          display: "flex", alignItems: "center", gap: 8,
          padding: collapsed ? "10px 0" : "10px 12px",
          justifyContent: collapsed ? "center" : "flex-start",
        }}>
          <div
            title={user.username}
            style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--signal-dim)",
              fontFamily: mono, fontSize: 12, fontWeight: 700,
              color: "var(--signal)", textTransform: "uppercase",
            }}
          >
            {user.username[0]}
          </div>
          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--text-1)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {user.username}
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 9, letterSpacing: "0.08em",
                  color: isUnlocked ? "var(--positive)" : "var(--warning)",
                }}>
                  {user.role === "admin" ? "ADMIN" : isUnlocked ? "AKTIF" : "MENUNGGU"}
                </div>
              </div>
              <button
                onClick={async () => { await logout(); window.location.href = "/"; }}
                title="Keluar"
                aria-label="Keluar"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 26, height: 26, borderRadius: 5, flexShrink: 0,
                  background: "transparent", border: "none",
                  color: "var(--text-4)", cursor: "pointer", transition: "color 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-4)"; }}
                data-testid="button-logout"
              >
                <LogOut style={{ width: 14, height: 14 }} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Theme toggle + collapse toggle ───────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--border-1)", display: "flex" }}>
        <button
          onClick={toggleTheme}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 0",
            color: "var(--text-3)",
            cursor: "pointer", background: "transparent", border: "none",
            flex: 1,
            transition: "color 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--signal)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
          data-testid="button-toggle-theme"
          title={theme === "dark" ? "Mode terang" : "Mode gelap"}
          aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
        >
          {theme === "dark"
            ? <Sun style={{ width: 15, height: 15 }} />
            : <Moon style={{ width: 15, height: 15 }} />}
          {!collapsed && (
            <span style={{ fontFamily: mono, fontSize: 11 }}>
              {theme === "dark" ? "Terang" : "Gelap"}
            </span>
          )}
        </button>
        <button
          onClick={onToggle}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 12px",
            borderLeft: "1px solid var(--border-1)",
            color: "var(--text-4)",
            cursor: "pointer", background: "transparent", border: "none",
            transition: "color 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-4)"; }}
          data-testid="button-toggle-sidebar"
          title={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
          aria-label={collapsed ? "Perluas sidebar" : "Kecilkan sidebar"}
        >
          {collapsed
            ? <ChevronsRight style={{ width: 15, height: 15 }} />
            : <ChevronsLeft  style={{ width: 15, height: 15 }} />}
        </button>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--border-1)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: marketOpen ? "var(--positive)" : "var(--text-4)",
                boxShadow: marketOpen ? "0 0 5px var(--positive)" : "none",
              }} />
              <span style={{
                fontFamily: mono, fontSize: 11, letterSpacing: "0.08em",
                color: marketOpen ? "var(--positive)" : "var(--text-4)",
              }}>
                {marketOpen ? "BUKA" : "TUTUP"}
              </span>
            </div>
            {wibTime && (
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", letterSpacing: "0.06em" }}>
                {wibTime} WIB
              </span>
            )}
          </div>
          <p style={{ fontFamily: mono, fontSize: 10, color: "var(--text-4)", letterSpacing: "0.06em" }}>
            BART v3.0 · IDX
          </p>
        </div>
      )}
    </aside>
  );
}

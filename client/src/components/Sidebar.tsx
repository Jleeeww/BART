import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  Radio,
  Star,
  SlidersHorizontal,
  BarChart2,
  Settings,
  Search,
} from "lucide-react";

const navItems = [
  { icon: LayoutGrid, label: "Peta Kesiapan", route: "/", exact: true },
  { icon: Radio, label: "Radar", route: "/radar" },
  { icon: Star, label: "Watchlist", route: "/watchlist", locked: true },
  { icon: SlidersHorizontal, label: "Screener", route: "/screener", locked: true },
  { icon: BarChart2, label: "Pasar", route: "/pasar", locked: true },
  { icon: Settings, label: "Pengaturan", route: "/pengaturan", locked: true },
] as const;

interface SearchResult {
  symbol: string;
  companyName: string;
  price: string;
  changePercent: string;
}

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  function isActive(route: string, exact?: boolean) {
    if (exact) {
      return location === route || location.startsWith("/stock/");
    }
    return location.startsWith(route);
  }

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleResultClick(symbol: string) {
    setQuery("");
    setIsOpen(false);
    setResults([]);
    setLocation(`/stock/${symbol}`);
  }

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-50"
      style={{
        width: 200,
        background: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <Link href="/">
        <div
          className="flex items-center px-4 cursor-pointer"
          style={{ height: 48, borderBottom: "1px solid rgba(255,255,255,0.03)" }}
        >
          <span
            className="font-bold text-base tracking-wider"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
          >
            BART
          </span>
        </div>
      </Link>

      <div
        ref={searchRef}
        className="px-3 py-3 relative"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 12, height: 12, color: "rgba(255,255,255,0.19)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari saham..."
            className="w-full rounded-md pl-8 pr-3 py-2 text-xs outline-none transition-all duration-150"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#fff",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(56,189,248,0.4)";
              e.currentTarget.style.background = "#1a1a1a";
              if (results.length > 0) setIsOpen(true);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
              e.currentTarget.style.background = "#161616";
            }}
            data-testid="input-search-stock"
          />
        </div>

        {isOpen && (
          <div
            className="absolute left-3 right-3 mt-1 z-50 rounded-md overflow-y-auto"
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.06)",
              maxHeight: 256,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            {isLoading ? (
              <p
                className="px-3 py-4 text-center text-[10px]"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(56,189,248,0.5)" }}
              >
                Memindai...
              </p>
            ) : results.length === 0 ? (
              <p
                className="px-3 py-4 text-center text-[10px]"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.19)" }}
              >
                Saham tidak ditemukan
              </p>
            ) : (
              results.map((r, i) => (
                <div
                  key={r.symbol}
                  className="px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-[rgba(56,189,248,0.1)]"
                  style={{
                    borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none",
                  }}
                  onMouseDown={() => handleResultClick(r.symbol)}
                  data-testid={`search-result-${r.symbol}`}
                >
                  <span
                    className="text-sm font-bold text-white flex-shrink-0"
                    style={{ fontFamily: "'Sora', sans-serif", width: 52 }}
                  >
                    {r.symbol}
                  </span>
                  <span
                    className="text-[10px] truncate flex-1"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6b7280" }}
                  >
                    {r.companyName}
                  </span>
                  <span
                    className="text-xs text-white flex-shrink-0"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {r.price}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const locked = "locked" in item && item.locked;
          const active = !locked && isActive(item.route, "exact" in item && item.exact);

          if (locked) {
            return (
              <div
                key={item.route}
                className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md cursor-not-allowed"
                style={{ color: "rgba(255,255,255,0.12)" }}
              >
                <Icon className="w-4 h-4" />
                <span
                  className="text-sm flex-1"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {item.label}
                </span>
                <span
                  className="px-1.5 rounded-sm"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    background: "rgba(255,255,255,0.02)",
                    color: "rgba(255,255,255,0.12)",
                  }}
                >
                  Segera
                </span>
              </div>
            );
          }

          return (
            <Link key={item.route} href={item.route}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-all duration-150 cursor-pointer ${
                  active
                    ? "text-[#38BDF8]"
                    : "text-[#6b7280] hover:text-white hover:bg-[#ffffff06]"
                }`}
                style={
                  active
                    ? {
                        background: "rgba(56,189,248,0.1)",
                        borderLeft: "2px solid #38BDF8",
                      }
                    : {}
                }
              >
                <Icon className="w-4 h-4" />
                <span
                  className="text-sm"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
      >
        <p
          className="tracking-wide"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.12)",
          }}
        >
          PT Berkat Digital Investasi
        </p>
        <p
          className="tracking-wide mt-0.5"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.12)",
          }}
        >
          BART v2.0
        </p>
      </div>
    </aside>
  );
}

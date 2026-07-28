import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

interface SearchResult {
  symbol: string;
  companyName: string;
  price: string;
  changePercent: string;
  source?: "yahoo";
}

/**
 * Debounced ticker search against GET /api/search (LQ45 universe + Yahoo
 * Finance cross-universe fallback — any IDX-listed stock, TradingView-style).
 * Extracted from Sidebar.tsx so it can be reused by the terminal-style
 * Beranda page's symbol switcher.
 */
export function SymbolSearch({
  onSelect,
  placeholder = "Cari saham...",
  autoFocus = false,
}: {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setDropOpen(false);
      return;
    }
    setIsLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
        setDropOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

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
    setQuery("");
    setDropOpen(false);
    setResults([]);
    onSelect(symbol);
  }

  return (
    <div ref={searchRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search
          style={{
            position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
            width: 13, height: 13, color: "var(--text-4)", pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 13,
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
        <div
          style={{
            position: "absolute", left: 0, right: 0, marginTop: 4, zIndex: 50,
            borderRadius: 6, overflow: "hidden auto",
            background: "var(--surface-1)", border: "1px solid var(--border-2)",
            maxHeight: 256,
          }}
        >
          {isLoading ? (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--signal)", textAlign: "center", padding: "14px 0" }}>
              Memindai...
            </p>
          ) : results.length === 0 ? (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-4)", textAlign: "center", padding: "14px 0" }}>
              Saham tidak ditemukan
            </p>
          ) : (
            results.map((r, i) => (
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
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--text-1)", flexShrink: 0, width: 48 }}>
                  {r.symbol}
                </span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.companyName}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12, color: "var(--text-2)", flexShrink: 0 }}>
                  {r.source === "yahoo" ? "·" : r.price}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

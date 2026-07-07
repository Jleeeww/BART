interface SymbolImpact {
  symbol: string;
  direction: string;
  strength: string;
}

interface SectorImpact {
  name: string;
  direction: string;
}

interface NewsArticleCardProps {
  title: string;
  summary?: string;
  source: string;
  publishedAt: string;
  url?: string;
  direction?: "POSITIF" | "NEGATIF" | "NETRAL";
  analyzed?: boolean;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  mechanism?: string;
  // Rich format: { symbol, direction, strength }[]; simple format: string[]
  affectedSymbols?: SymbolImpact[] | string[];
  affectedSectors?: SectorImpact[];
  onSymbolClick?: (symbol: string) => void;
}

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";

function directionColor(dir?: string): string {
  if (dir === "POSITIF") return "var(--positive)";
  if (dir === "NEGATIF") return "var(--danger)";
  return "var(--text-3)";
}

function directionIcon(dir: string): string {
  if (dir === "POSITIF") return "▲";
  if (dir === "NEGATIF") return "▼";
  return "—";
}

function severityColor(sev: string): { fg: string; bg: string; border: string } {
  if (sev === "CRITICAL") return { fg: "var(--danger)", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" };
  if (sev === "HIGH")     return { fg: "var(--warning)", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" };
  if (sev === "MEDIUM")   return { fg: "var(--signal)", bg: "rgba(79,195,247,0.1)",  border: "rgba(79,195,247,0.25)" };
  return                         { fg: "var(--text-3)", bg: "rgba(113,113,122,0.08)", border: "rgba(113,113,122,0.2)" };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function isSymbolImpact(x: unknown): x is SymbolImpact {
  return typeof x === "object" && x !== null && "symbol" in x;
}

export function NewsArticleCard({
  title, summary, source, publishedAt, url,
  direction, analyzed, severity, mechanism,
  affectedSymbols, affectedSectors, onSymbolClick,
}: NewsArticleCardProps) {
  const dColor = directionColor(direction);
  const sevStyle = severity ? severityColor(severity) : null;
  const isUnanalyzed = analyzed === false;

  // Normalise affectedSymbols to SymbolImpact[]
  const symImpacts: SymbolImpact[] = (affectedSymbols ?? []).map((s) =>
    isSymbolImpact(s) ? s : { symbol: s, direction: "NETRAL", strength: "LEMAH" }
  );

  const cardContent = (
    <div
      style={{
        background: isUnanalyzed ? "var(--surface-1)" : "var(--surface-1)",
        border: "1px solid var(--border-1)",
        borderRadius: 8,
        padding: "14px 16px",
        opacity: isUnanalyzed ? 0.6 : 1,
        transition: url ? "border-color 0.1s" : undefined,
      }}
      onMouseEnter={url ? (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(79,195,247,0.2)"; } : undefined}
      onMouseLeave={url ? (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-1)"; } : undefined}
    >
      {/* Header row: source · date · badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Direction dot */}
          {direction && (
            <div style={{
              width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
              background: dColor, boxShadow: `0 0 4px ${dColor}60`,
            }} />
          )}
          <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", letterSpacing: "0.04em" }}>
            {source}
          </span>
          {/* Severity badge */}
          {sevStyle && severity && (
            <span style={{
              fontFamily: mono, fontSize: 13, fontWeight: 700,
              letterSpacing: "0.08em", color: sevStyle.fg,
              background: sevStyle.bg, border: `1px solid ${sevStyle.border}`,
              borderRadius: 3, padding: "1px 6px",
            }}>
              {severity}
            </span>
          )}
          {/* Direction badge */}
          {direction && direction !== "NETRAL" && (
            <span style={{
              fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: dColor, background: `${dColor}12`,
              border: `1px solid ${dColor}30`,
              borderRadius: 3, padding: "1px 6px",
            }}>
              {direction}
            </span>
          )}
          {/* Unanalyzed badge */}
          {isUnanalyzed && (
            <span style={{
              fontFamily: mono, fontSize: 13, color: "var(--text-4)",
              background: "var(--border-1)", border: "1px solid var(--border-2)",
              borderRadius: 3, padding: "1px 6px",
            }}>
              Belum dianalisis
            </span>
          )}
        </div>
        <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)", flexShrink: 0 }}>
          {formatDate(publishedAt)}
        </span>
      </div>

      {/* Title */}
      <p style={{
        fontFamily: inter, fontSize: 13, fontWeight: 500,
        color: "var(--text-1)", lineHeight: 1.5,
        marginBottom: (summary || mechanism) ? 8 : 0,
      }}>
        {title}
      </p>

      {/* Mechanism / trader implication */}
      {mechanism && (
        <p style={{
          fontFamily: inter, fontSize: 12, color: "var(--text-2)",
          lineHeight: 1.55, marginBottom: 8,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {mechanism}
        </p>
      )}

      {/* Fallback summary if no mechanism */}
      {!mechanism && summary && (
        <p style={{
          fontFamily: inter, fontSize: 12, color: "var(--text-3)",
          lineHeight: 1.55, marginBottom: 8,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {summary}
        </p>
      )}

      {/* Affected symbols */}
      {symImpacts.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: affectedSectors?.length ? 6 : 0 }}>
          {symImpacts.map((s) => {
            const sColor = directionColor(s.direction);
            return (
              <button
                key={s.symbol}
                onClick={onSymbolClick ? (e) => { e.preventDefault(); e.stopPropagation(); onSymbolClick(s.symbol); } : undefined}
                style={{
                  fontFamily: mono, fontSize: 13, fontWeight: 700,
                  color: sColor, background: `${sColor}12`,
                  border: `1px solid ${sColor}30`,
                  borderRadius: 3, padding: "2px 6px",
                  cursor: onSymbolClick ? "pointer" : "default",
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                <span style={{ fontSize: 12 }}>{directionIcon(s.direction)}</span>
                {s.symbol}
              </button>
            );
          })}
        </div>
      )}

      {/* Affected sectors */}
      {affectedSectors && affectedSectors.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: url ? 8 : 0 }}>
          {affectedSectors.map((sec) => (
            <span
              key={sec.name}
              style={{
                fontFamily: mono, fontSize: 13, color: "var(--text-3)",
                background: "var(--border-1)",
                border: "1px solid var(--border-2)",
                borderRadius: 3, padding: "2px 6px",
              }}
            >
              {sec.name}
            </span>
          ))}
        </div>
      )}

      {/* Article link */}
      {url && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 12, color: "var(--signal)",
            letterSpacing: "0.04em",
          }}>
            Baca artikel asli ↗
          </span>
        </div>
      )}
    </div>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none" }}>
        {cardContent}
      </a>
    );
  }
  return cardContent;
}

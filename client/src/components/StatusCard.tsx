import { ScoreRing } from "./ScoreRing";
import { DecisionBadge } from "./DecisionBadge";

interface StatusCardProps {
  score: number;
  decision: string;
  statusLabel?: string;
  symbol?: string;
  date?: string;
  confidence?: number;
  layerCount?: number;
  newsOverride?: boolean;
  managementRedFlag?: boolean;
  onAnalysisClick?: () => void;
}

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";

function accentColor(decision: string) {
  if (decision === "SIAP_DIPANTAU")      return "#4ADE80";
  if (decision === "WATCHLIST_PRIORITAS") return "#FBBF24";
  if (decision === "HINDARI_DULU")        return "#F87171";
  return "#3F3F46";
}

function cardGlow(decision: string) {
  if (decision === "SIAP_DIPANTAU")      return "0 0 40px rgba(74,222,128,0.06)";
  if (decision === "WATCHLIST_PRIORITAS") return "0 0 40px rgba(251,191,36,0.06)";
  if (decision === "HINDARI_DULU")        return "0 0 40px rgba(248,113,113,0.06)";
  return "none";
}

export function StatusCard({
  score, decision, statusLabel, symbol, date,
  confidence = 0, layerCount = 0,
  newsOverride, managementRedFlag, onAnalysisClick,
}: StatusCardProps) {
  const accent = accentColor(decision);
  const today = date ?? new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div style={{
      display: "flex", overflow: "hidden",
      background: "#0a0a0a",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      boxShadow: cardGlow(decision),
    }}>
      {/* Left accent bar */}
      <div style={{ width: 3, background: accent, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: "20px 24px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#3F3F46",
          }}>
            KESIAPAN TRADING{symbol ? ` · ${symbol}` : ""}
          </span>
          <span style={{ fontFamily: mono, fontSize: 9, color: "#3F3F46", letterSpacing: "0.06em" }}>
            SESI · {today}
          </span>
        </div>

        {/* Ring + Right content */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 28 }}>
          <div style={{ flexShrink: 0 }}>
            <ScoreRing score={score} size={140} showLabel />
          </div>

          {/* Right column — 3 vertical zones */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            justifyContent: "space-between", minHeight: 140,
          }}>
            {/* Zone 1 — badge + override pills */}
            <div>
              <DecisionBadge decision={decision} size="md" showIcon />
              {newsOverride && (
                <div style={{
                  marginTop: 10, padding: "5px 10px", borderRadius: 5,
                  background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)",
                  display: "inline-flex", alignItems: "center",
                }}>
                  <span style={{ fontFamily: mono, fontSize: 8, color: "#FBBF24", letterSpacing: "0.05em" }}>
                    ⚡ OVERRIDE MAKRO AKTIF
                  </span>
                </div>
              )}
              {managementRedFlag && (
                <div style={{
                  marginTop: 6, padding: "5px 10px", borderRadius: 5,
                  background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)",
                  display: "inline-flex", alignItems: "center",
                }}>
                  <span style={{ fontFamily: mono, fontSize: 8, color: "#F87171", letterSpacing: "0.05em" }}>
                    ⚠ BENDERA MERAH MANAJEMEN
                  </span>
                </div>
              )}
            </div>

            {/* Zone 2 — statusLabel headline */}
            <div>
              {statusLabel ? (
                <p style={{ fontFamily: inter, fontSize: 14, fontWeight: 500, color: "#F4F4F5", lineHeight: 1.6 }}>
                  {statusLabel}
                </p>
              ) : (
                <p style={{ fontFamily: inter, fontSize: 14, color: "#3F3F46", lineHeight: 1.6 }}>
                  Memuat analisis...
                </p>
              )}
            </div>

            {/* Zone 3 — CTA + meta */}
            <div>
              <button
                onClick={onAnalysisClick}
                style={{
                  fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                  fontWeight: 600, color: "#4FC3F7",
                  background: "rgba(79,195,247,0.07)",
                  border: "1px solid rgba(79,195,247,0.2)",
                  borderRadius: 6, padding: "7px 14px",
                  cursor: "pointer", display: "inline-block",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(79,195,247,0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(79,195,247,0.07)"; }}
              >
                ANALISIS LENGKAP →
              </button>
              <p style={{ fontFamily: mono, fontSize: 9, color: "#3F3F46", letterSpacing: "0.06em", marginTop: 8 }}>
                Keyakinan {confidence}%{layerCount > 0 ? ` · ${layerCount}/6 layer aktif` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer — nearly invisible */}
        <p style={{
          marginTop: 14, textAlign: "center",
          fontFamily: mono, fontSize: 7, color: "rgba(255,255,255,0.06)", lineHeight: 1.5,
        }}>
          Panduan probabilistik — bukan sinyal transaksi. Selalu lakukan analisis mandiri.
        </p>
      </div>
    </div>
  );
}

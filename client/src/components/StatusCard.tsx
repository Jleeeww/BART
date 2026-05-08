import { ScoreRing } from "./ScoreRing";
import { DecisionBadge } from "./DecisionBadge";

interface StatusCardProps {
  score: number;
  decision: string;
  mainReasons: string[];
  mainRisk: string;
  traderProfile: string;
  statusLabel?: string;
  newsOverride?: boolean;
  managementRedFlag?: boolean;
}

const mono = "'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";

function accentColor(decision: string) {
  if (decision === "SIAP_DIPANTAU") return "#34D399";
  if (decision === "WATCHLIST_PRIORITAS") return "#FBBF24";
  if (decision === "HINDARI_DULU") return "#F87171";
  return "#9CA3AF";
}

function cardGlow(decision: string) {
  if (decision === "SIAP_DIPANTAU") return "0 0 24px rgba(52,211,153,0.08)";
  if (decision === "WATCHLIST_PRIORITAS") return "0 0 24px rgba(251,191,36,0.08)";
  if (decision === "HINDARI_DULU") return "0 0 24px rgba(248,113,113,0.08)";
  return "none";
}

export function StatusCard({
  score, decision, mainReasons, mainRisk, traderProfile,
  statusLabel, newsOverride, managementRedFlag,
}: StatusCardProps) {
  const accent = accentColor(decision);

  return (
    <div style={{
      display: "flex", overflow: "hidden",
      background: "#111111",
      border: "1px solid #1F2937",
      borderRadius: 12,
      boxShadow: cardGlow(decision),
    }}>
      {/* Left accent bar */}
      <div style={{ width: 4, background: accent, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: "24px 24px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{
            fontFamily: mono, fontSize: 9, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "#6B7280",
          }}>
            KESIAPAN TRADING
          </span>
          <DecisionBadge decision={decision} size="md" showIcon />
        </div>

        {/* Override banners */}
        {newsOverride && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 6,
            background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: "#FBBF24", letterSpacing: "0.05em" }}>
              ⚡ OVERRIDE MAKRO AKTIF
            </span>
          </div>
        )}
        {managementRedFlag && (
          <div style={{
            marginBottom: 12, padding: "8px 12px", borderRadius: 6,
            background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontFamily: mono, fontSize: 9, color: "#F87171", letterSpacing: "0.05em" }}>
              ⚠ BENDERA MERAH MANAJEMEN
            </span>
          </div>
        )}

        {/* Score ring + reasons */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
          <ScoreRing score={score} size={120} strokeWidth={8} showLabel />
          <div style={{ flex: 1, paddingTop: 4 }}>
            {statusLabel && (
              <p style={{ fontFamily: inter, fontSize: 13, color: "#9CA3AF", marginBottom: 12, lineHeight: 1.55 }}>
                {statusLabel}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mainReasons.slice(0, 3).map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: accent, fontFamily: mono, fontSize: 11, lineHeight: "20px", flexShrink: 0 }}>
                    →
                  </span>
                  <span style={{ fontFamily: inter, fontSize: 13, color: "#D1D5DB", lineHeight: 1.55 }}>
                    {r}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: 16 }} />

        {/* Risk + Profile row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#161616", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{
              fontFamily: mono, fontSize: 9, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "#6B7280", marginBottom: 6,
            }}>
              RISIKO UTAMA
            </p>
            <p style={{ fontFamily: inter, fontSize: 12, color: "#9CA3AF", lineHeight: 1.55 }}>
              {mainRisk || "—"}
            </p>
          </div>
          <div style={{ background: "#161616", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{
              fontFamily: mono, fontSize: 9, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "#6B7280", marginBottom: 6,
            }}>
              PROFIL TRADER
            </p>
            <p style={{ fontFamily: inter, fontSize: 12, color: "#9CA3AF", lineHeight: 1.55 }}>
              {traderProfile || "—"}
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{
          marginTop: 16, textAlign: "center",
          fontFamily: mono, fontSize: 8, color: "#374151", lineHeight: 1.6,
        }}>
          Panduan probabilistik — bukan sinyal transaksi. Selalu lakukan analisis mandiri.
        </p>
      </div>
    </div>
  );
}

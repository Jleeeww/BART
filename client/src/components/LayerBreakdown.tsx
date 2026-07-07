import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface LayerBreakdownProps {
  bandarmologyScore: number | null;
  newsScore: number | null;
  fundamentalScore: number | null;
  managementScore: number | null;
  valuationScore: number | null;
  macroScore: number | null;
  confidence: number;
  defaultCollapsed?: boolean;
}

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

const LAYERS = [
  { key: "bandarmology", label: "Bandarmologi",   weight: 25 },
  { key: "news",         label: "Berita & Makro",  weight: 25 },
  { key: "fundamental",  label: "Fundamental",     weight: 20 },
  { key: "management",   label: "Manajemen",        weight: 15 },
  { key: "valuation",    label: "Valuasi",           weight: 10 },
  { key: "macro",        label: "Rotasi Sektor",     weight: 5  },
];

function barColor(score: number | null): string {
  if (score === null) return "var(--border-2)";
  if (score >= 70) return "#10B981";
  if (score >= 50) return "var(--signal)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

function confColor(c: number): string {
  if (c >= 70) return "#10B981";
  if (c >= 50) return "var(--signal)";
  if (c >= 40) return "var(--warning)";
  return "var(--danger)";
}

const STATUS_MAP: Record<string, [string, string, string, string]> = {
  bandarmology: ["Akumulasi Aktif",  "Akumulasi Ringan", "Netral",          "Distribusi"],
  news:         ["Sentimen Positif", "Netral",           "Perhatian",       "Override Makro"],
  fundamental:  ["Fundamental Kuat", "Moderat",          "Rapuh",           "Lemah"],
  management:   ["Manajemen Kuat",   "Memadai",          "Perlu Perhatian", "Bendera Merah"],
  valuation:    ["Valuasi Wajar",    "Moderat",          "Agak Mahal",      "Valuasi Mahal"],
  macro:        ["Sektor Panas",     "Netral",           "Melandai",        "Sektor Dingin"],
};

function layerStatus(key: string, score: number | null): string | null {
  if (score === null) return null;
  const [s70, s50, s40, s0] = STATUS_MAP[key] ?? ["", "", "", ""];
  if (score >= 70) return s70;
  if (score >= 50) return s50;
  if (score >= 40) return s40;
  return s0;
}

export function LayerBreakdown({
  bandarmologyScore, newsScore, fundamentalScore, managementScore,
  valuationScore, macroScore, confidence, defaultCollapsed = true,
}: LayerBreakdownProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const scores: Record<string, number | null> = {
    bandarmology: bandarmologyScore,
    news:         newsScore,
    fundamental:  fundamentalScore,
    management:   managementScore,
    valuation:    valuationScore,
    macro:        macroScore,
  };

  const cc = confColor(confidence);
  const activeCount = Object.values(scores).filter(v => v !== null).length;

  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border-2)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", cursor: "pointer", background: "transparent", border: "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--text-3)" }}>
          ANALISIS 6 LAYER
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 12, color: cc }}>
            Keyakinan {confidence}% · {activeCount}/6 aktif
          </span>
          {collapsed
            ? <ChevronDown size={14} color="var(--text-3)" />
            : <ChevronUp size={14} color="var(--text-3)" />}
        </div>
      </button>

      {!collapsed && (
        <div style={{ borderTop: "1px solid var(--border-1)", padding: "8px 20px 20px" }}>
          {LAYERS.map((layer) => {
            const score = scores[layer.key];
            const color = barColor(score);
            const pct = score !== null ? score : 0;
            const status = layerStatus(layer.key, score);
            const isNull = score === null;
            return (
              <div key={layer.key} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                {/* Layer name */}
                <div style={{ width: 112, flexShrink: 0 }}>
                  <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-2)" }}>{layer.label}</span>
                </div>
                {/* Weight badge */}
                <span style={{
                  fontFamily: mono, fontSize: 13, color: "var(--text-4)",
                  background: "var(--border-1)", borderRadius: 3,
                  padding: "1px 5px", flexShrink: 0, width: 28, textAlign: "center",
                }}>
                  {layer.weight}%
                </span>
                {/* Progress bar */}
                <div style={{
                  flex: 1, height: 3, background: "var(--border-1)",
                  borderRadius: 9999, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: color, borderRadius: 9999,
                    transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                    animation: isNull ? "pulse 2s infinite" : undefined,
                  }} />
                </div>
                {/* Score number */}
                <div style={{
                  width: 30, flexShrink: 0, textAlign: "right",
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  color: isNull ? "var(--text-4)" : color,
                }}>
                  {score !== null ? score : "—"}
                </div>
                {/* Status badge */}
                {status && (
                  <span style={{
                    fontFamily: mono, fontSize: 13,
                    color, background: `${color}14`,
                    border: `1px solid ${color}28`,
                    borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                  }}>
                    {status}
                  </span>
                )}
                {isNull && !status && (
                  <span style={{ fontFamily: mono, fontSize: 13, color: "var(--text-4)", flexShrink: 0 }}>
                    Memuat...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

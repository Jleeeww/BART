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

const mono = "'IBM Plex Mono', monospace";

const LAYERS = [
  { key: "bandarmology", label: "Bandarmologi",   weight: 25 },
  { key: "news",         label: "Berita & Makro",  weight: 25 },
  { key: "fundamental",  label: "Fundamental",     weight: 20 },
  { key: "management",   label: "Manajemen",        weight: 15 },
  { key: "valuation",    label: "Valuasi",           weight: 10 },
  { key: "macro",        label: "Rotasi Sektor",     weight: 5  },
];

function barColor(score: number | null) {
  if (score === null) return "rgba(255,255,255,0.08)";
  if (score >= 70) return "#34D399";
  if (score >= 50) return "#FBBF24";
  return "#F87171";
}

const STATUS_MAP: Record<string, [string, string, string]> = {
  bandarmology: ["Akumulasi Aktif",  "Akumulasi Ringan", "Distribusi"],
  news:         ["Sentimen Positif", "Netral",           "Override Makro"],
  fundamental:  ["Fundamental Kuat", "Moderat",          "Lemah"],
  management:   ["Manajemen Kuat",   "Memadai",          "Bendera Merah"],
  valuation:    ["Valuasi Wajar",    "Moderat",          "Valuasi Mahal"],
  macro:        ["Sektor Panas",     "Netral",           "Sektor Dingin"],
};

function layerStatus(key: string, score: number | null): string | null {
  if (score === null) return null;
  const [high, mid, low] = STATUS_MAP[key] ?? ["", "", ""];
  if (score >= 70) return high;
  if (score >= 50) return mid;
  return low;
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

  const confColor = confidence >= 70 ? "#34D399" : confidence >= 50 ? "#FBBF24" : "#F87171";

  return (
    <div style={{
      background: "#111111",
      border: "1px solid #1F2937",
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
        <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6B7280" }}>
          ANALISIS 6 LAYER
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: confColor }}>
            Keyakinan: {confidence}%
          </span>
          {collapsed
            ? <ChevronDown size={14} color="#6B7280" />
            : <ChevronUp size={14} color="#6B7280" />}
        </div>
      </button>

      {!collapsed && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "4px 20px 20px" }}>
          {LAYERS.map((layer) => {
            const score = scores[layer.key];
            const color = barColor(score);
            const pct = score !== null ? score : 0;
            const status = layerStatus(layer.key, score);
            return (
              <div key={layer.key} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <div style={{ width: 108, flexShrink: 0 }}>
                  <span style={{ fontFamily: mono, fontSize: 10, color: "#9CA3AF" }}>{layer.label}</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: "#6B7280", width: 26, flexShrink: 0 }}>
                  {layer.weight}%
                </div>
                <div style={{
                  flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: color, borderRadius: 9999,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <div style={{
                  width: 28, flexShrink: 0, textAlign: "right",
                  fontFamily: mono, fontSize: 11, fontWeight: 700, color,
                }}>
                  {score !== null ? score : "—"}
                </div>
                {status && (
                  <span style={{
                    fontFamily: mono, fontSize: 8, color,
                    background: `${color}18`, border: `1px solid ${color}30`,
                    borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                  }}>
                    {status}
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

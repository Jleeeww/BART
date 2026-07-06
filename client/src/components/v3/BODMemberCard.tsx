interface BODMemberCardProps {
  name: string;
  title: string;
  compositeScore: number | null;
  keyInsight?: string;
  hasCriticalRedFlag?: boolean;
  reliability?: "HIGH" | "MEDIUM" | "LOW";
  excluded?: boolean;
}

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";

function scoreColor(score: number): string {
  if (score >= 70) return "#4ADE80";
  if (score >= 50) return "#4FC3F7";
  if (score >= 40) return "#FBBF24";
  return "#F87171";
}

function reliabilityLabel(r?: string): string {
  if (r === "HIGH")   return "Data Kuat";
  if (r === "MEDIUM") return "Data Sedang";
  return "Data Terbatas";
}

export function BODMemberCard({
  name, title, compositeScore, keyInsight,
  hasCriticalRedFlag, reliability, excluded,
}: BODMemberCardProps) {
  const color = compositeScore !== null ? scoreColor(compositeScore) : "#3F3F46";

  return (
    <div style={{
      background: "#0a0a0a",
      border: hasCriticalRedFlag
        ? "1px solid rgba(248,113,113,0.3)"
        : "1px solid rgba(255,255,255,0.05)",
      borderRadius: 8, padding: "14px 16px",
      opacity: excluded ? 0.5 : 1,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "#F4F4F5", marginBottom: 2 }}>
            {name}
          </p>
          <p style={{ fontFamily: inter, fontSize: 11, color: "#71717A", lineHeight: 1.4 }}>
            {title}
          </p>
        </div>
        {/* Score */}
        {compositeScore !== null ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>
              {compositeScore}
            </p>
            <p style={{ fontFamily: mono, fontSize: 8, color: "#3F3F46", marginTop: 2 }}>/100</p>
          </div>
        ) : (
          <p style={{ fontFamily: mono, fontSize: 10, color: "#3F3F46" }}>—</p>
        )}
      </div>

      {/* Score bar */}
      {compositeScore !== null && (
        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 9999, marginBottom: 10 }}>
          <div style={{ height: "100%", width: `${compositeScore}%`, background: color, borderRadius: 9999 }} />
        </div>
      )}

      {/* Red flag */}
      {hasCriticalRedFlag && (
        <div style={{
          marginBottom: 8, padding: "4px 8px", borderRadius: 4,
          background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          <span style={{ fontFamily: mono, fontSize: 8, color: "#F87171", letterSpacing: "0.05em" }}>
            ⚠ BENDERA MERAH
          </span>
        </div>
      )}

      {/* Key insight */}
      {keyInsight && (
        <p style={{ fontFamily: inter, fontSize: 11, color: "#A1A1AA", lineHeight: 1.55 }}>
          {keyInsight}
        </p>
      )}

      {/* Reliability */}
      {reliability && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 8, color: "#3F3F46",
            background: "rgba(255,255,255,0.03)", borderRadius: 3, padding: "1px 5px",
          }}>
            {reliabilityLabel(reliability)}
          </span>
        </div>
      )}
    </div>
  );
}

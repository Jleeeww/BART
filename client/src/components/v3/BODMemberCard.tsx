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
  if (score >= 70) return "var(--positive)";
  if (score >= 50) return "var(--signal)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
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
  const color = compositeScore !== null ? scoreColor(compositeScore) : "var(--text-4)";

  return (
    <div style={{
      background: "var(--surface-1)",
      border: hasCriticalRedFlag
        ? "1px solid rgba(248,113,113,0.3)"
        : "1px solid var(--border-1)",
      borderRadius: 8, padding: "14px 16px",
      opacity: excluded ? 0.5 : 1,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>
            {name}
          </p>
          <p style={{ fontFamily: inter, fontSize: 13, color: "var(--text-3)", lineHeight: 1.4 }}>
            {title}
          </p>
        </div>
        {/* Score */}
        {compositeScore !== null ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>
              {compositeScore}
            </p>
            <p style={{ fontFamily: mono, fontSize: 13, color: "var(--text-4)", marginTop: 2 }}>/100</p>
          </div>
        ) : (
          <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)" }}>—</p>
        )}
      </div>

      {/* Score bar */}
      {compositeScore !== null && (
        <div style={{ height: 2, background: "var(--border-1)", borderRadius: 9999, marginBottom: 10 }}>
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
          <span style={{ fontFamily: mono, fontSize: 13, color: "var(--danger)", letterSpacing: "0.05em" }}>
            ⚠ BENDERA MERAH
          </span>
        </div>
      )}

      {/* Key insight */}
      {keyInsight && (
        <p style={{ fontFamily: inter, fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
          {keyInsight}
        </p>
      )}

      {/* Reliability */}
      {reliability && (
        <div style={{ marginTop: 8 }}>
          <span style={{
            fontFamily: mono, fontSize: 13, color: "var(--text-4)",
            background: "var(--border-1)", borderRadius: 3, padding: "1px 5px",
          }}>
            {reliabilityLabel(reliability)}
          </span>
        </div>
      )}
    </div>
  );
}

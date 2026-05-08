interface DecisionBadgeProps {
  decision: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  WATCHLIST_PRIORITAS: {
    label: "Watchlist Prioritas", icon: "★",
    bg: "rgba(251,191,36,0.12)", text: "#FBBF24", border: "rgba(251,191,36,0.40)",
  },
  SIAP_DIPANTAU: {
    label: "Siap Entry", icon: "✓",
    bg: "rgba(52,211,153,0.12)", text: "#34D399", border: "rgba(52,211,153,0.40)",
  },
  HINDARI_DULU: {
    label: "Hindari Dulu", icon: "✕",
    bg: "rgba(248,113,113,0.12)", text: "#F87171", border: "rgba(248,113,113,0.40)",
  },
  NETRAL: {
    label: "Netral", icon: "○",
    bg: "rgba(107,114,128,0.12)", text: "#9CA3AF", border: "rgba(107,114,128,0.40)",
  },
};

const SIZES = {
  sm: { fontSize: 9,  px: 8,  py: 3, gap: 4 },
  md: { fontSize: 11, px: 10, py: 5, gap: 5 },
  lg: { fontSize: 13, px: 14, py: 7, gap: 7 },
};

const mono = "'IBM Plex Mono', monospace";

export function DecisionBadge({ decision, size = "md", showIcon = true }: DecisionBadgeProps) {
  const cfg = CONFIG[decision] ?? CONFIG.NETRAL;
  const sz = SIZES[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: sz.gap,
      padding: `${sz.py}px ${sz.px}px`,
      borderRadius: 9999,
      background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      fontFamily: mono, fontSize: sz.fontSize,
      fontWeight: 600, letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>
      {showIcon && <span style={{ fontSize: sz.fontSize + 1 }}>{cfg.icon}</span>}
      {cfg.label}
    </span>
  );
}

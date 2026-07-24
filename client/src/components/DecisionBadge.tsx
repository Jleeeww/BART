interface DecisionBadgeProps {
  decision: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

const CONFIG: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  WATCHLIST_PRIORITAS: {
    label: "Watchlist Prioritas", icon: "★",
    bg: "rgba(245,158,11,0.10)", text: "var(--warning)", border: "rgba(245,158,11,0.30)",
  },
  SIAP_DIPANTAU: {
    label: "Siap Entry", icon: "✓",
    bg: "rgba(16,185,129,0.10)", text: "#10B981", border: "rgba(16,185,129,0.30)",
  },
  HINDARI_DULU: {
    label: "Hindari Dulu", icon: "✕",
    bg: "rgba(239,68,68,0.10)", text: "var(--danger)", border: "rgba(239,68,68,0.30)",
  },
  NETRAL: {
    label: "Netral", icon: "○",
    bg: "rgba(113,113,122,0.10)", text: "var(--text-3)", border: "rgba(113,113,122,0.30)",
  },
};

const SIZES = {
  sm: { fontSize: 12,  px: 8,  py: 3, gap: 4 },
  md: { fontSize: 13, px: 10, py: 5, gap: 5 },
  lg: { fontSize: 13, px: 14, py: 7, gap: 7 },
};

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

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

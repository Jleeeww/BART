import { useEffect, useId, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

const VIEWBOX = 200;
const CX = 100;
const CY = 100;
const R = 88;
const CIRC = 2 * Math.PI * R;

function ringColor(score: number): string {
  if (score >= 70) return "var(--positive)";
  if (score >= 50) return "var(--signal)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

export function ScoreRing({ score, size = 120, showLabel = true }: ScoreRingProps) {
  const [animated, setAnimated] = useState(false);
  const uid = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, score));
  const color = ringColor(clamped);
  const filled = animated ? (clamped / 100) * CIRC : 0;

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
      <defs>
        <radialGradient id={`rg-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-1)" strokeWidth="3" />
      {/* Glow fill */}
      <circle cx={CX} cy={CY} r={78} fill={`url(#rg-${uid})`} />
      {/* Arc */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRC}`}
        transform="rotate(-90 100 100)"
        style={{
          filter: `drop-shadow(0 0 6px ${color}50)`,
          transition: "stroke-dasharray 800ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      {/* Score number */}
      <text
        x={CX} y={107} textAnchor="middle"
        fontFamily="'JetBrains Mono', 'IBM Plex Mono', monospace"
        fontSize="48" fontWeight="600" fill="var(--text-1)" letterSpacing="-0.03em"
      >
        {clamped}
      </text>
      {showLabel && (
        <text
          x={CX} y={128} textAnchor="middle"
          fontFamily="'JetBrains Mono', 'IBM Plex Mono', monospace"
          fontSize="11" fontWeight="400" fill="var(--text-4)" letterSpacing="0.08em"
        >
          / 100
        </text>
      )}
    </svg>
  );
}

import { useEffect, useId, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 50) return "#38BDF8";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

const VIEWBOX = 200;
const CX = 100;
const CY = 100;
const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R; // ~552.9

export function ScoreRing({ score, size = 120, showLabel = true }: ScoreRingProps) {
  const [animated, setAnimated] = useState(false);
  const uid = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, score));
  const color = scoreColor(clamped);

  const filled = animated ? (clamped / 100) * CIRCUMFERENCE : 0;
  const dashArray = `${filled} ${CIRCUMFERENCE}`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      style={{ flexShrink: 0, overflow: "visible" }}
      aria-label={`Score: ${clamped} / 100`}
    >
      <defs>
        <radialGradient id={`grad-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="3"
      />

      {/* Inner gradient fill */}
      <circle
        cx={CX} cy={CY} r={78}
        fill={`url(#grad-${uid})`}
        opacity="0.3"
      />

      {/* Progress arc */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={dashArray}
        transform="rotate(-90 100 100)"
        style={{
          filter: `drop-shadow(0 0 8px ${color}40)`,
          transition: "stroke-dasharray 800ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* Score value */}
      <text
        x={CX} y={105}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', 'IBM Plex Mono', monospace"
        fontSize="48"
        fontWeight="600"
        fill="#F4F4F5"
        letterSpacing="-0.03em"
      >
        {clamped}
      </text>

      {/* / 100 label */}
      {showLabel && (
        <text
          x={CX} y={128}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', 'IBM Plex Mono', monospace"
          fontSize="11"
          fontWeight="500"
          fill="#71717A"
          letterSpacing="0.08em"
        >
          / 100
        </text>
      )}
    </svg>
  );
}

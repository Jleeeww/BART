import { useEffect, useRef, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

const mono = "'IBM Plex Mono', monospace";

function ringColor(score: number) {
  if (score >= 60) return "#34D399";
  if (score >= 40) return "#FBBF24";
  return "#F87171";
}

function ringGlow(score: number) {
  if (score >= 60) return "drop-shadow(0 0 6px rgba(52,211,153,0.25))";
  if (score >= 40) return "drop-shadow(0 0 6px rgba(251,191,36,0.25))";
  return "drop-shadow(0 0 6px rgba(248,113,113,0.25))";
}

export function ScoreRing({ score, size = 120, strokeWidth = 8, showLabel = true }: ScoreRingProps) {
  const [animated, setAnimated] = useState(false);
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated ? clamped / 100 : 0) * circumference;
  const color = ringColor(clamped);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", filter: ringGlow(clamped) }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: mono, fontWeight: 700,
          fontSize: Math.round(size * 0.28), color, lineHeight: 1,
        }}>
          {clamped}
        </span>
        {showLabel && (
          <span style={{
            fontFamily: mono,
            fontSize: Math.round(size * 0.11),
            color: "#6B7280", marginTop: 2,
          }}>
            /100
          </span>
        )}
      </div>
    </div>
  );
}

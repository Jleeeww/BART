interface MiniSparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function MiniSparkline({ values, width = 60, height = 16, color }: MiniSparklineProps) {
  if (!values || values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const autoColor = values[values.length - 1] >= values[0] ? "#34D399" : "#F87171";
  const stroke = color ?? autoColor;

  const step = width / (values.length - 1);
  const pts = values
    .map((v, i) => {
      const x = i * step;
      const y = height - 1 - ((v - min) / range) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

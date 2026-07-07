import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Design tokens ────────────────────────────────────────────────────────────
const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";
const S0 = "var(--surface-0)";
const S1 = "var(--surface-1)";
const S2 = "var(--surface-2)";
const S3 = "var(--surface-3)";
const B1 = "var(--border-2)";
const B2 = "rgba(255,255,255,0.10)";
const T1 = "var(--text-1)";
const T2 = "var(--text-2)";
const T3 = "var(--text-3)";
const T4 = "var(--text-4)";
const SIGNAL = "var(--signal)";
const POSITIVE = "var(--positive)";
const WARNING = "var(--warning)";
const DANGER = "var(--danger)";

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StockData {
  symbol: string;
  name: string;
  price: string;
  changePercent: string;
  readinessScore: number;
  homepageBucket: string;
  flowBias?: string;
}

interface SectorRotationSector {
  sector: string;
  displayName: string;
  rotationScore: number;
  direction: "MASUK" | "KELUAR" | "NETRAL";
  stockCount: number;
  akumulasiCount: number;
  distribusiCount: number;
  topStocks: {
    symbol: string;
    companyName: string;
    readinessScore: number;
    cyclePosition: string | null;
    flowBias: string | null;
  }[];
  momentum: "NAIK" | "TURUN" | "STABIL";
  previousScore: number | null;
}

interface SectorRotationSnapshot {
  sectors: SectorRotationSector[];
  hotSectors: string[];
  coldSectors: string[];
  rotationStrength: "KUAT" | "SEDANG" | "LEMAH";
  dominantTheme: string;
  computedAt: string;
  isStale: boolean;
}

interface MacroCommodity {
  name: string;
  currentPrice: number | null;
  change5d: number | null;
  trend: "NAIK" | "TURUN" | "STABIL" | null;
  unit: string;
  source: "LIVE" | "FALLBACK";
}

interface MacroSignal {
  type: string;
  sector: string;
  effect: "POSITIF" | "NEGATIF" | "NETRAL";
  strength: "KUAT" | "SEDANG" | "LEMAH";
  description: string;
}

interface MacroContextSnapshot {
  oil: MacroCommodity;
  gold: MacroCommodity;
  usdIdr: MacroCommodity;
  signals: MacroSignal[];
  marketSentiment: "RISK_ON" | "RISK_OFF" | "NETRAL";
  sentimentReason: string;
  computedAt: string;
  isStale: boolean;
}

interface AltDataSnapshot {
  weather: {
    regionId: string;
    regionName: string;
    sector: string;
    rainfallMm: number | null;
    weatherCode: string | null;
    temperature: number | null;
    fetchedAt: string;
  }[];
  cpo: {
    priceIDR: number | null;
    priceUSD: number | null;
    trend: string | null;
    fetchedAt: string;
    source: string;
  };
  coal: {
    hba1USD: number | null;
    hba2USD: number | null;
    hba3USD: number | null;
    trend: string | null;
    fetchedAt: string;
    source: string;
  };
  degradedSources: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getIDXSessionStatus(): { label: string; color: "green" | "yellow" | "red" } {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const totalMinutes = Math.floor(wibMinutes / 60) * 60 + (wibMinutes % 60);
  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return { label: "Pasar Tutup", color: "red" };
  if (totalMinutes >= 8 * 60 + 45 && totalMinutes < 9 * 60) return { label: "Pra-Pembukaan", color: "yellow" };
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) return { label: "Sesi 1 Berlangsung", color: "green" };
  if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) return { label: "Istirahat", color: "yellow" };
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) return { label: "Sesi 2 Berlangsung", color: "green" };
  if (totalMinutes >= 15 * 60 + 50 && totalMinutes < 16 * 60) return { label: "Pra-Penutupan", color: "yellow" };
  return { label: "Pasar Tutup", color: "red" };
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

const SECTOR_MAP: Record<string, string> = {
  Financials: "Keuangan",
  Energy: "Energi",
  Industrials: "Industri",
  "Communication Services": "Telekomunikasi",
  "Consumer Staples": "Konsumer Primer",
  "Consumer Discretionary": "Konsumer Sekunder",
  "Real Estate": "Properti",
  "Basic Materials": "Material & Tambang",
  ALL: "Semua Sektor",
};

// short 2-3 char label for scatter plot
function sectorShortName(name: string): string {
  const map: Record<string, string> = {
    Financials: "FIN",
    Energy: "ENR",
    Industrials: "IND",
    "Communication Services": "TEL",
    "Consumer Staples": "KNS",
    "Consumer Discretionary": "KND",
    "Real Estate": "PRO",
    "Basic Materials": "MTB",
  };
  if (map[name]) return map[name];
  return name.slice(0, 3).toUpperCase();
}

// Map momentum to SVG x coordinate
function momentumToX(momentum: "NAIK" | "TURUN" | "STABIL"): number {
  const pct = momentum === "TURUN" ? 20 : momentum === "STABIL" ? 50 : 80;
  // map 0..100 → 40..300
  return 40 + (pct / 100) * 260;
}

// Map rotationScore (0-100) to SVG y coordinate (inverted)
function scoreToY(score: number): number {
  // 0→300, 100→40
  return 300 - (score / 100) * 260;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: mono,
        fontSize: 12,
        letterSpacing: "0.18em",
        color: T4,
        textTransform: "uppercase" as const,
        margin: "0 0 14px",
      }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: 1, background: B1, margin: "12px 0" }} />;
}

// ─── Zone A: Header Bar ───────────────────────────────────────────────────────
function HeaderBar({ sessionStatus }: { sessionStatus: ReturnType<typeof getIDXSessionStatus> }) {
  const dotColor =
    sessionStatus.color === "green"
      ? POSITIVE
      : sessionStatus.color === "yellow"
      ? WARNING
      : DANGER;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: S0,
        borderBottom: `1px solid ${B1}`,
        padding: "0 32px",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        {/* Left */}
        <div>
          <p
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.2em",
              color: T4,
              textTransform: "uppercase" as const,
              margin: "0 0 2px",
            }}
          >
            MACRO TERMINAL
          </p>
          <h1
            style={{
              fontFamily: inter,
              fontSize: 20,
              fontWeight: 600,
              color: T1,
              letterSpacing: "-0.02em",
              margin: 0,
              lineHeight: 1,
            }}
          >
            Pasar & Makro
          </h1>
        </div>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Session status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: dotColor,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: mono, fontSize: 12, color: dotColor }}>
              {sessionStatus.label}
            </span>
          </div>

          {/* LIVE indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(79,195,247,0.07)",
              border: `1px solid rgba(79,195,247,0.18)`,
              borderRadius: 4,
              padding: "3px 8px",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: SIGNAL,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: mono, fontSize: 12, color: SIGNAL, letterSpacing: "0.12em" }}>
              LIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Zone B: Commodity Ticker Strip ──────────────────────────────────────────
interface TickerItem {
  key: string;
  label: string;
  price: string;
  change5d: number | null;
  trend: string | null;
  source: string;
}

function CommodityTicker({ items }: { items: TickerItem[] }) {
  return (
    <div
      style={{
        background: S1,
        borderBottom: `1px solid ${B1}`,
        padding: "0 32px",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
        }}
      >
        {items.map((item, idx) => {
          const changeColor =
            item.change5d == null ? T4 : item.change5d >= 0 ? POSITIVE : DANGER;
          const trendArrow =
            item.trend === "NAIK" ? "▲" : item.trend === "TURUN" ? "▼" : "—";
          const isFallback = item.source?.includes("FALLBACK");

          return (
            <div
              key={item.key}
              style={{
                padding: "10px 16px",
                borderRight: idx < items.length - 1 ? `1px solid ${B1}` : "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Label */}
              <span style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em", flexShrink: 0 }}>
                {item.label}
              </span>

              {/* Divider pip */}
              <span style={{ color: B2, fontSize: 12 }}>|</span>

              {/* Price */}
              <span style={{ fontFamily: mono, fontSize: 13, color: T1, fontWeight: 600, flexShrink: 0 }}>
                {item.price}
              </span>

              {/* Change % */}
              <span style={{ fontFamily: mono, fontSize: 12, color: changeColor, flexShrink: 0 }}>
                {item.change5d == null
                  ? "—"
                  : `${item.change5d >= 0 ? "+" : ""}${item.change5d.toFixed(2)}%`}
              </span>

              {/* Trend arrow */}
              <span style={{ fontFamily: mono, fontSize: 12, color: changeColor, flexShrink: 0 }}>
                {trendArrow}
              </span>

              {/* STALE badge */}
              {isFallback && (
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: T4,
                    background: "rgba(63,63,70,0.4)",
                    border: `1px solid ${T4}`,
                    borderRadius: 3,
                    padding: "1px 5px",
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                  }}
                >
                  STALE
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Zone C Col 1: Sector Rotation SVG Scatter Plot ──────────────────────────
interface ScatterPlotProps {
  sectors: SectorRotationSector[];
  hoveredSector: string | null;
  onHover: (sector: string | null) => void;
  hotSectors: string[];
}

function SectorScatterPlot({ sectors, hoveredSector, onHover, hotSectors }: ScatterPlotProps) {
  const W = 340;
  const H = 340;

  // tooltip state
  const hoveredObj = hoveredSector ? sectors.find((s) => s.sector === hoveredSector) : null;

  return (
    <div
      style={{
        background: S1,
        border: `1px solid ${B1}`,
        borderRadius: 10,
        padding: "20px",
        position: "relative" as const,
      }}
    >
      <Eyebrow>MATRIKS ROTASI SEKTOR</Eyebrow>

      <div style={{ position: "relative" as const, width: W, height: H }}>
        <svg width={W} height={H} style={{ display: "block" }}>
          {/* Quadrant divider lines */}
          <line x1={170} y1={40} x2={170} y2={300} stroke="var(--border-1)" strokeWidth={1} />
          <line x1={40} y1={170} x2={300} y2={170} stroke="var(--border-1)" strokeWidth={1} />

          {/* Quadrant labels */}
          {/* Top-right: MEMIMPIN */}
          <text x={238} y={55} fill={T4} fontSize={8} fontFamily={mono} textAnchor="middle">
            MEMIMPIN
          </text>
          {/* Top-left: MEMBAIK */}
          <text x={100} y={55} fill={T4} fontSize={8} fontFamily={mono} textAnchor="middle">
            MEMBAIK
          </text>
          {/* Bottom-right: MELEMAH */}
          <text x={238} y={295} fill={T4} fontSize={8} fontFamily={mono} textAnchor="middle">
            MELEMAH
          </text>
          {/* Bottom-left: TERTINGGAL */}
          <text x={100} y={295} fill={T4} fontSize={8} fontFamily={mono} textAnchor="middle">
            TERTINGGAL
          </text>

          {/* Axis labels */}
          <text x={40} y={320} fill={T4} fontSize={7} fontFamily={mono}>TURUN</text>
          <text x={155} y={320} fill={T4} fontSize={7} fontFamily={mono}>MOMENTUM</text>
          <text x={270} y={320} fill={T4} fontSize={7} fontFamily={mono}>NAIK</text>

          {/* Sectors */}
          {sectors.map((s) => {
            const cx = momentumToX(s.momentum);
            const cy = scoreToY(s.rotationScore);
            const isHovered = hoveredSector === s.sector;
            const isHot = hotSectors.includes(s.sector);

            const baseColor =
              s.direction === "MASUK"
                ? POSITIVE
                : s.direction === "KELUAR"
                ? DANGER
                : T4;

            const fillOpacity = isHovered ? 0.55 : 0.4;
            const r = isHovered ? 10 : 8;

            return (
              <g
                key={s.sector}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => onHover(s.sector)}
                onMouseLeave={() => onHover(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 6}
                  fill="transparent"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={baseColor}
                  fillOpacity={fillOpacity}
                  stroke={baseColor}
                  strokeWidth={isHovered ? 1.5 : 1}
                />
                {isHot && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 3}
                    fill="none"
                    stroke={WARNING}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.6}
                  />
                )}
                <text
                  x={cx}
                  y={cy + r + 10}
                  fill={T3}
                  fontSize={7}
                  fontFamily={mono}
                  textAnchor="middle"
                >
                  {sectorShortName(s.sector)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoveredObj && (
          <div
            style={{
              position: "absolute" as const,
              top: 0,
              right: -220,
              width: 200,
              background: S3,
              border: `1px solid ${B2}`,
              borderRadius: 8,
              padding: "12px 14px",
              zIndex: 10,
              pointerEvents: "none" as const,
            }}
          >
            <p style={{ fontFamily: mono, fontSize: 12, color: T4, margin: "0 0 4px", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              {sectorShortName(hoveredObj.sector)}
            </p>
            <p style={{ fontFamily: inter, fontSize: 13, color: T1, fontWeight: 600, margin: "0 0 8px" }}>
              {hoveredObj.displayName}
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color:
                    hoveredObj.direction === "MASUK"
                      ? POSITIVE
                      : hoveredObj.direction === "KELUAR"
                      ? DANGER
                      : T3,
                  background:
                    hoveredObj.direction === "MASUK"
                      ? "rgba(74,222,128,0.1)"
                      : hoveredObj.direction === "KELUAR"
                      ? "rgba(248,113,113,0.1)"
                      : "var(--border-1)",
                  border: `1px solid ${
                    hoveredObj.direction === "MASUK"
                      ? "rgba(74,222,128,0.2)"
                      : hoveredObj.direction === "KELUAR"
                      ? "rgba(248,113,113,0.2)"
                      : B1
                  }`,
                  borderRadius: 3,
                  padding: "1px 6px",
                }}
              >
                {hoveredObj.direction}
              </span>
              <span style={{ fontFamily: mono, fontSize: 12, color: T1, fontWeight: 700 }}>
                {hoveredObj.rotationScore}
              </span>
            </div>
            {hoveredObj.topStocks.length > 0 && (
              <div>
                <p style={{ fontFamily: mono, fontSize: 13, color: T4, margin: "0 0 4px", letterSpacing: "0.08em" }}>TOP STOCKS</p>
                {hoveredObj.topStocks.slice(0, 3).map((ts) => (
                  <p key={ts.symbol} style={{ fontFamily: mono, fontSize: 12, color: T2, margin: "2px 0" }}>
                    {ts.symbol} <span style={{ color: T4 }}>{ts.readinessScore}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {[
          { color: POSITIVE, label: "MASUK" },
          { color: DANGER, label: "KELUAR" },
          { color: T4, label: "NETRAL" },
        ].map((leg) => (
          <div key={leg.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: leg.color,
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: mono, fontSize: 13, color: T4, letterSpacing: "0.08em" }}>
              {leg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Zone C Col 2: Macro Signals Causal Chain ────────────────────────────────
interface MacroSignalsCardProps {
  macroContext: MacroContextSnapshot | null;
}

function MacroSignalsCard({ macroContext }: MacroSignalsCardProps) {
  const sentimentLabel =
    macroContext?.marketSentiment === "RISK_ON"
      ? "RISK ON"
      : macroContext?.marketSentiment === "RISK_OFF"
      ? "RISK OFF"
      : "NETRAL";

  const sentimentColor =
    macroContext?.marketSentiment === "RISK_ON"
      ? POSITIVE
      : macroContext?.marketSentiment === "RISK_OFF"
      ? DANGER
      : T3;

  const sentimentBg =
    macroContext?.marketSentiment === "RISK_ON"
      ? "rgba(74,222,128,0.06)"
      : macroContext?.marketSentiment === "RISK_OFF"
      ? "rgba(248,113,113,0.06)"
      : "rgba(255,255,255,0.02)";

  const sentimentBorder =
    macroContext?.marketSentiment === "RISK_ON"
      ? "rgba(74,222,128,0.2)"
      : macroContext?.marketSentiment === "RISK_OFF"
      ? "rgba(248,113,113,0.2)"
      : B1;

  const typeColor = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes("commodity") || t.includes("oil") || t.includes("gold") || t.includes("coal") || t.includes("cpo")) return SIGNAL;
    if (t.includes("fx") || t.includes("usd") || t.includes("idr") || t.includes("currency")) return WARNING;
    return T2;
  };

  const typeBg = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes("commodity") || t.includes("oil") || t.includes("gold") || t.includes("coal") || t.includes("cpo")) return "rgba(79,195,247,0.08)";
    if (t.includes("fx") || t.includes("usd") || t.includes("idr") || t.includes("currency")) return "rgba(251,191,36,0.08)";
    return "rgba(161,161,170,0.06)";
  };

  const typeBorder = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes("commodity") || t.includes("oil") || t.includes("gold") || t.includes("coal") || t.includes("cpo")) return "rgba(79,195,247,0.18)";
    if (t.includes("fx") || t.includes("usd") || t.includes("idr") || t.includes("currency")) return "rgba(251,191,36,0.18)";
    return "rgba(161,161,170,0.12)";
  };

  return (
    <div
      style={{
        background: S1,
        border: `1px solid ${B1}`,
        borderRadius: 10,
        padding: "20px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 0,
      }}
    >
      <Eyebrow>RANTAI KAUSALITAS MAKRO</Eyebrow>

      {/* Signals list */}
      <div style={{ flex: 1 }}>
        {!macroContext ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>
            [ MEMUAT... ]
          </p>
        ) : macroContext.signals?.length ? (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
            {macroContext.signals.map((sig, i) => {
              const effectColor =
                sig.effect === "POSITIF" ? POSITIVE : sig.effect === "NEGATIF" ? DANGER : T3;
              const effectBg =
                sig.effect === "POSITIF"
                  ? "rgba(74,222,128,0.08)"
                  : sig.effect === "NEGATIF"
                  ? "rgba(248,113,113,0.08)"
                  : "var(--border-1)";
              const effectBorder =
                sig.effect === "POSITIF"
                  ? "rgba(74,222,128,0.2)"
                  : sig.effect === "NEGATIF"
                  ? "rgba(248,113,113,0.2)"
                  : B1;

              return (
                <div
                  key={i}
                  style={{
                    paddingTop: i === 0 ? 0 : 12,
                    paddingBottom: i < macroContext.signals.length - 1 ? 12 : 0,
                    borderBottom:
                      i < macroContext.signals.length - 1 ? `1px solid ${B1}` : "none",
                  }}
                >
                  {/* Cause → Effect row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" as const }}>
                    {/* Source type badge */}
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 13,
                        color: typeColor(sig.type),
                        background: typeBg(sig.type),
                        border: `1px solid ${typeBorder(sig.type)}`,
                        borderRadius: 3,
                        padding: "2px 6px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase" as const,
                        flexShrink: 0,
                      }}
                    >
                      {sig.type}
                    </span>

                    {/* Arrow */}
                    <span style={{ fontFamily: mono, fontSize: 13, color: T4 }}>→</span>

                    {/* Sector name */}
                    <span style={{ fontFamily: mono, fontSize: 12, color: T2 }}>
                      {SECTOR_MAP[sig.sector] ?? sig.sector}
                    </span>

                    {/* Effect badge */}
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 13,
                        color: effectColor,
                        background: effectBg,
                        border: `1px solid ${effectBorder}`,
                        borderRadius: 3,
                        padding: "2px 6px",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      {sig.effect}
                    </span>

                    {/* Strength */}
                    <span style={{ fontFamily: mono, fontSize: 13, color: T4, marginLeft: "auto" }}>
                      {sig.strength}
                    </span>
                  </div>

                  {/* Description */}
                  <p style={{ fontFamily: inter, fontSize: 13, color: T3, margin: 0, lineHeight: 1.55 }}>
                    {sig.description}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>
            [ TIDAK ADA SINYAL AKTIF ]
          </p>
        )}
      </div>

      {/* Market sentiment block */}
      {macroContext && (
        <div style={{ marginTop: 16 }}>
          <Divider />
          <div
            style={{
              background: sentimentBg,
              border: `1px solid ${sentimentBorder}`,
              borderRadius: 8,
              padding: "14px 16px",
              marginTop: 12,
            }}
          >
            <p
              style={{
                fontFamily: mono,
                fontSize: 18,
                fontWeight: 700,
                color: sentimentColor,
                letterSpacing: "0.06em",
                margin: "0 0 6px",
              }}
            >
              {sentimentLabel}
            </p>
            {macroContext.sentimentReason && (
              <p style={{ fontFamily: inter, fontSize: 13, color: T3, margin: 0, lineHeight: 1.5 }}>
                {macroContext.sentimentReason}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Zone C Col 3: Alt Data Stack ────────────────────────────────────────────
interface AltDataCardProps {
  altData: AltDataSnapshot | null;
}

function AltDataCard({ altData }: AltDataCardProps) {
  const weatherColors = (mm: number | null): string => {
    if (mm === null) return T4;
    if (mm > 100) return "#60A5FA"; // blue
    if (mm >= 50) return SIGNAL;
    return T4;
  };

  const weatherIcon = (code: string | null): string => {
    if (!code) return "—";
    const c = code.toLowerCase();
    if (c.includes("rain") || c.includes("hujan")) return "🌧";
    if (c.includes("cloud") || c.includes("awan")) return "☁";
    if (c.includes("sun") || c.includes("cerah")) return "☀";
    if (c.includes("storm") || c.includes("badai")) return "⛈";
    return code;
  };

  return (
    <div
      style={{
        background: S1,
        border: `1px solid ${B1}`,
        borderRadius: 10,
        padding: "20px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 0,
      }}
    >
      <Eyebrow>DATA ALTERNATIF</Eyebrow>

      {/* Degraded sources warning */}
      {altData && altData.degradedSources?.length > 0 && (
        <div
          style={{
            background: "rgba(251,191,36,0.06)",
            border: `1px solid rgba(251,191,36,0.18)`,
            borderRadius: 6,
            padding: "6px 10px",
            marginBottom: 14,
          }}
        >
          <p style={{ fontFamily: mono, fontSize: 12, color: WARNING, margin: 0 }}>
            Sumber data degraded: {altData.degradedSources.join(", ")}
          </p>
        </div>
      )}

      {/* ── Commodities sub-section ── */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: mono, fontSize: 13, color: T4, letterSpacing: "0.14em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>
          KOMODITAS
        </p>

        {!altData ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>[ MEMUAT... ]</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            {/* Coal HBA1 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: mono, fontSize: 12, color: T4, margin: "0 0 2px", letterSpacing: "0.08em" }}>BATUBARA HBA1</p>
                <p style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: T1, margin: 0 }}>
                  {altData.coal.hba1USD != null ? `$${altData.coal.hba1USD}` : "—"}
                </p>
                <p style={{ fontFamily: mono, fontSize: 13, color: T4, margin: "2px 0 0" }}>USD/ton</p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                {altData.coal.trend && (
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color:
                        altData.coal.trend === "NAIK"
                          ? POSITIVE
                          : altData.coal.trend === "TURUN"
                          ? DANGER
                          : T3,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {altData.coal.trend === "NAIK" ? "▲ NAIK" : altData.coal.trend === "TURUN" ? "▼ TURUN" : "→ STABIL"}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: altData.coal.source?.includes("FALLBACK") ? T4 : POSITIVE,
                    background: altData.coal.source?.includes("FALLBACK") ? "rgba(63,63,70,0.3)" : "rgba(74,222,128,0.07)",
                    border: `1px solid ${altData.coal.source?.includes("FALLBACK") ? T4 : "rgba(74,222,128,0.2)"}`,
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  {altData.coal.source?.includes("FALLBACK") ? "STALE" : "LIVE"}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: B1 }} />

            {/* CPO */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontFamily: mono, fontSize: 12, color: T4, margin: "0 0 2px", letterSpacing: "0.08em" }}>CPO SAWIT</p>
                <p style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: T1, margin: 0 }}>
                  {altData.cpo.priceUSD != null ? `$${altData.cpo.priceUSD}` : altData.cpo.priceIDR != null ? altData.cpo.priceIDR.toLocaleString("id-ID") : "—"}
                </p>
                <p style={{ fontFamily: mono, fontSize: 13, color: T4, margin: "2px 0 0" }}>
                  {altData.cpo.priceUSD != null ? "USD/MT" : "IDR/kg"}
                </p>
              </div>
              <div style={{ textAlign: "right" as const }}>
                {altData.cpo.trend && (
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color:
                        altData.cpo.trend === "NAIK"
                          ? POSITIVE
                          : altData.cpo.trend === "TURUN"
                          ? DANGER
                          : T3,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {altData.cpo.trend === "NAIK" ? "▲ NAIK" : altData.cpo.trend === "TURUN" ? "▼ TURUN" : "→ STABIL"}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: altData.cpo.source?.includes("FALLBACK") ? T4 : POSITIVE,
                    background: altData.cpo.source?.includes("FALLBACK") ? "rgba(63,63,70,0.3)" : "rgba(74,222,128,0.07)",
                    border: `1px solid ${altData.cpo.source?.includes("FALLBACK") ? T4 : "rgba(74,222,128,0.2)"}`,
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  {altData.cpo.source?.includes("FALLBACK") ? "STALE" : "LIVE"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* ── Weather sub-section ── */}
      <div>
        <p style={{ fontFamily: mono, fontSize: 13, color: T4, letterSpacing: "0.14em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>
          CUACA REGIONAL
        </p>

        {!altData ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>[ MEMUAT... ]</p>
        ) : altData.weather.length === 0 ? (
          <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>[ MEMUAT... ]</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
            {altData.weather.slice(0, 4).map((w, i, arr) => (
              <div
                key={w.regionId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: i === 0 ? 0 : 8,
                  paddingBottom: i < arr.length - 1 ? 8 : 0,
                  borderBottom: i < arr.length - 1 ? `1px solid ${B1}` : "none",
                }}
              >
                <div>
                  <p style={{ fontFamily: inter, fontSize: 13, color: T2, margin: "0 0 2px" }}>
                    {w.regionName}
                  </p>
                  {w.temperature !== null && (
                    <p style={{ fontFamily: mono, fontSize: 12, color: T4, margin: 0 }}>
                      {w.temperature}°C
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12 }}>{weatherIcon(w.weatherCode)}</span>
                  <span
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      color: weatherColors(w.rainfallMm),
                      fontWeight: 600,
                    }}
                  >
                    {w.rainfallMm != null ? `${w.rainfallMm}mm` : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Zone D: Sector Detail Panel ─────────────────────────────────────────────
interface SectorDetailPanelProps {
  sectorData: SectorRotationSnapshot;
  hoveredSector: string | null;
  onSelectSector: (sector: string | null) => void;
}

function SectorDetailPanel({ sectorData, hoveredSector, onSelectSector }: SectorDetailPanelProps) {
  return (
    <div
      style={{
        maxWidth: 1280,
        margin: "20px auto 0",
        padding: "0 32px",
      }}
    >
      <div
        style={{
          background: S1,
          border: `1px solid ${B1}`,
          borderRadius: 10,
          padding: "16px 20px",
        }}
      >
        {/* Scrollable pills row */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto" as const,
            paddingBottom: 8,
          }}
        >
          {sectorData.sectors.map((s) => {
            const scoreColor =
              s.rotationScore >= 60
                ? POSITIVE
                : s.rotationScore >= 40
                ? WARNING
                : DANGER;
            const isHot = sectorData.hotSectors.includes(s.sector);
            const isSelected = hoveredSector === s.sector;

            return (
              <div
                key={s.sector}
                onClick={() => onSelectSector(isSelected ? null : s.sector)}
                style={{
                  flexShrink: 0,
                  background: isSelected ? S3 : S2,
                  border: `1px solid ${isSelected ? B2 : B1}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                  cursor: "pointer",
                  minWidth: 160,
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <p style={{ fontFamily: inter, fontSize: 13, fontWeight: 600, color: T1, margin: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                    {s.displayName}
                  </p>
                  {isHot && (
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 12,
                        color: WARNING,
                        background: "rgba(251,191,36,0.1)",
                        border: `1px solid rgba(251,191,36,0.2)`,
                        borderRadius: 3,
                        padding: "1px 4px",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      HOT
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
                    {s.rotationScore}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, color: T4 }}>
                    {s.momentum === "NAIK" ? "↑" : s.momentum === "TURUN" ? "↓" : "→"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 13, color: POSITIVE }}>
                    ↑{s.akumulasiCount} akum
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 13, color: DANGER }}>
                    ↓{s.distribusiCount} dist
                  </span>
                </div>

                {s.topStocks.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                    {s.topStocks.slice(0, 3).map((ts) => (
                      <span
                        key={ts.symbol}
                        style={{
                          fontFamily: mono,
                          fontSize: 13,
                          color: T4,
                          background: B1,
                          borderRadius: 3,
                          padding: "1px 5px",
                        }}
                      >
                        {ts.symbol}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Metadata row */}
        <div style={{ display: "flex", gap: 20, marginTop: 10, alignItems: "center" }}>
          {sectorData.dominantTheme && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 13, color: T4, letterSpacing: "0.08em" }}>TEMA</span>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: SIGNAL,
                  background: "rgba(79,195,247,0.06)",
                  border: `1px solid rgba(79,195,247,0.15)`,
                  borderRadius: 4,
                  padding: "2px 8px",
                }}
              >
                {sectorData.dominantTheme}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: mono, fontSize: 13, color: T4, letterSpacing: "0.08em" }}>ROTASI</span>
            <span
              style={{
                fontFamily: mono,
                fontSize: 12,
                color:
                  sectorData.rotationStrength === "KUAT"
                    ? POSITIVE
                    : sectorData.rotationStrength === "SEDANG"
                    ? WARNING
                    : T3,
              }}
            >
              {sectorData.rotationStrength}
            </span>
          </div>
          {sectorData.computedAt && (
            <span style={{ fontFamily: mono, fontSize: 13, color: T4, marginLeft: "auto" }}>
              {formatTimestamp(sectorData.computedAt)}
              {sectorData.isStale && (
                <span style={{ color: WARNING, marginLeft: 6 }}>· STALE</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PasarPage() {
  const [sessionStatus, setSessionStatus] = useState(getIDXSessionStatus());
  const [altData, setAltData] = useState<AltDataSnapshot | null>(null);
  const [sectorData, setSectorData] = useState<SectorRotationSnapshot | null>(null);
  const [macroContext, setMacroContext] = useState<MacroContextSnapshot | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const { data: stocks } = useQuery<StockData[]>({ queryKey: ["/api/stocks"] });

  useEffect(() => {
    const interval = setInterval(() => setSessionStatus(getIDXSessionStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/alt-data/snapshot")
      .then((r) => r.json())
      .then((d) => setAltData(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/sector-rotation")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && Array.isArray(data.sectors)) setSectorData(data);
      })
      .catch(() => {});

    fetch("/api/macro-context")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && data.oil && data.gold && data.usdIdr && Array.isArray(data.signals)) {
          setMacroContext(data);
        }
      })
      .catch(() => {});
  }, []);

  // Commodity ticker items
  const tickerItems: TickerItem[] = useMemo(() => [
    {
      key: "oil",
      label: "WTI OIL",
      price:
        macroContext?.oil?.currentPrice != null
          ? `$${macroContext.oil.currentPrice.toFixed(2)}`
          : "—",
      change5d: macroContext?.oil?.change5d ?? null,
      trend: macroContext?.oil?.trend ?? null,
      source: macroContext?.oil?.source ?? "FALLBACK",
    },
    {
      key: "gold",
      label: "GOLD",
      price:
        macroContext?.gold?.currentPrice != null
          ? `$${macroContext.gold.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : "—",
      change5d: macroContext?.gold?.change5d ?? null,
      trend: macroContext?.gold?.trend ?? null,
      source: macroContext?.gold?.source ?? "FALLBACK",
    },
    {
      key: "usdIdr",
      label: "USD/IDR",
      price:
        macroContext?.usdIdr?.currentPrice != null
          ? macroContext.usdIdr.currentPrice.toLocaleString("id-ID")
          : "—",
      change5d: macroContext?.usdIdr?.change5d ?? null,
      trend: macroContext?.usdIdr?.trend ?? null,
      source: macroContext?.usdIdr?.source ?? "FALLBACK",
    },
    {
      key: "cpo",
      label: "CPO",
      price:
        altData?.cpo?.priceUSD != null
          ? `$${altData.cpo.priceUSD}/MT`
          : altData?.cpo?.priceIDR != null
          ? altData.cpo.priceIDR.toLocaleString("id-ID")
          : "—",
      change5d: null,
      trend: altData?.cpo?.trend ?? null,
      source: altData?.cpo?.source ?? "FALLBACK",
    },
  ], [macroContext, altData]);

  // suppress unused var warning — stocks is kept for potential use
  void stocks;

  return (
    <div style={{ minHeight: "100vh", background: S0, paddingBottom: 80 }}>

      {/* ── Zone A: Header Bar ───────────────────────────────────────────── */}
      <HeaderBar sessionStatus={sessionStatus} />

      {/* ── Zone B: Commodity Ticker ─────────────────────────────────────── */}
      <CommodityTicker items={tickerItems} />

      {/* ── Zone C: Three-column body ────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1280,
          margin: "24px auto 0",
          padding: "0 32px",
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        {/* Column 1: Sector Rotation Scatter Plot */}
        <div style={{ flex: "1.2", minWidth: 0 }}>
          {!sectorData ? (
            <div
              style={{
                background: S1,
                border: `1px solid ${B1}`,
                borderRadius: 10,
                padding: "20px",
                minHeight: 300,
                display: "flex",
                flexDirection: "column" as const,
              }}
            >
              <Eyebrow>MATRIKS ROTASI SEKTOR</Eyebrow>
              <p style={{ fontFamily: mono, fontSize: 12, color: T4, letterSpacing: "0.1em" }}>
                [ MEMUAT... ]
              </p>
            </div>
          ) : (
            <SectorScatterPlot
              sectors={sectorData.sectors}
              hoveredSector={hoveredSector}
              onHover={setHoveredSector}
              hotSectors={sectorData.hotSectors}
            />
          )}
        </div>

        {/* Column 2: Macro Signals Causal Chain */}
        <div style={{ flex: "1", minWidth: 0 }}>
          <MacroSignalsCard macroContext={macroContext} />
        </div>

        {/* Column 3: Alt Data Stack */}
        <div style={{ flex: "0.8", minWidth: 0 }}>
          <AltDataCard altData={altData} />
        </div>
      </div>

      {/* ── Zone D: Sector Detail Panel ──────────────────────────────────── */}
      {sectorData && sectorData.sectors?.length > 0 && (
        <SectorDetailPanel
          sectorData={sectorData}
          hoveredSector={hoveredSector}
          onSelectSector={setHoveredSector}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1280,
          margin: "40px auto 0",
          padding: "20px 32px 0",
          borderTop: `1px solid ${B1}`,
        }}
      >
        <p
          style={{
            fontFamily: mono,
            fontSize: 12,
            color: T4,
            textAlign: "center" as const,
            letterSpacing: "0.06em",
          }}
        >
          BART MACRO TERMINAL · Data alternatif: BMKG, ESDM · PT Berkat Digital Investasi
        </p>
      </div>
    </div>
  );
}

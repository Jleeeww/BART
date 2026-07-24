/**
 * ChatWidgets.tsx — typed widget registry for Chat with BART.
 *
 * Renders the deterministic widget payloads produced by
 * server/engine/chatTools.ts (streamed via SSE `widget` events and
 * persisted on chat_messages.widgets). Charts use recharts, themed
 * through the app's CSS custom properties so light/dark both work.
 */
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import type { ChatWidgetData } from "@/lib/chatStream";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

// ── Formatters ────────────────────────────────────────────────
const fmtNum = (v: number | null | undefined, digits = 2): string =>
  v == null || !isFinite(v) ? "N/A" : v.toLocaleString("id-ID", { maximumFractionDigits: digits });

const fmtB = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "N/A" : `${v > 0 ? "+" : ""}${fmtNum(v, 1)} M`;

const fmtPct = (v: number | null | undefined): string =>
  v == null || !isFinite(v) ? "N/A" : `${v > 0 ? "+" : ""}${fmtNum(v, 2)}%`;

const signColor = (v: number | null | undefined): string =>
  v == null ? "var(--text-4)" : v > 0 ? "var(--positive)" : v < 0 ? "var(--danger)" : "var(--text-3)";

const actionColorVar = (c: string | undefined): string =>
  c === "green" ? "var(--positive)" : c === "yellow" ? "var(--warning)" : c === "red" ? "var(--danger)" : "var(--text-3)";

// ── Shared building blocks ────────────────────────────────────
function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid var(--border-2)", borderRadius: 8, overflow: "hidden",
      background: "var(--surface-1)", marginTop: 8,
    }}>
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--border-1)",
        fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        color: "var(--text-3)", textTransform: "uppercase",
      }}>
        {title}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: "1 1 90px", minWidth: 90, padding: "8px 10px", borderRadius: 6,
      background: "var(--surface-2)", border: "1px solid var(--border-1)",
    }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "var(--text-4)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: color ?? "var(--text-1)", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 10, fontWeight: 600, color,
      border: `1px solid ${color}`, borderRadius: 3, padding: "1px 6px",
    }}>
      {text}
    </span>
  );
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--surface-2)", border: "1px solid var(--border-2)", borderRadius: 6,
      padding: "6px 10px", fontFamily: mono, fontSize: 11, color: "var(--text-1)",
    }}>
      <div style={{ color: "var(--text-4)", marginBottom: 2 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i}>{formatter ? formatter(p) : `${p.name}: ${fmtNum(p.value)}`}</div>
      ))}
    </div>
  );
}

const axisTick = { fontFamily: mono, fontSize: 10, fill: "var(--text-4)" } as const;

// ── price_chart ───────────────────────────────────────────────
function PriceChartWidget({ data }: { data: Record<string, any> }) {
  const bars: { time: string; close: number }[] = data.bars ?? [];
  const up = (data.changePct ?? 0) >= 0;
  const color = up ? "var(--positive)" : "var(--danger)";
  if (bars.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <StatTile label="Harga terakhir" value={fmtNum(data.latestClose, 0)} />
        <StatTile label="Perubahan periode" value={fmtPct(data.changePct)} color={signColor(data.changePct)} />
        <StatTile label="Sumber" value={String(data.source ?? "-")} />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" tick={axisTick} tickLine={false} axisLine={false}
            interval="preserveStartEnd" minTickGap={48}
            tickFormatter={(t: string) => t.slice(5)} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52}
            domain={["auto", "auto"]} tickFormatter={(v: number) => fmtNum(v, 0)} />
          <Tooltip content={<ChartTooltip formatter={(p: any) => `Close: ${fmtNum(p.value, 0)}`} />} />
          <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2}
            fill={`url(#grad-${data.symbol})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── bandar_flow ───────────────────────────────────────────────
function BandarFlowWidget({ data }: { data: Record<string, any> }) {
  const rows: { broker: string; valueB: number | null; type: string }[] = [
    ...(data.topBuyers ?? []),
    ...(data.topSellers ?? []),
  ].filter((r) => r.valueB != null);
  rows.sort((a, b) => (b.valueB ?? 0) - (a.valueB ?? 0));
  const height = Math.max(120, rows.length * 24 + 30);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <StatTile label="Net Asing" value={fmtB(data.foreignNetB)} color={signColor(data.foreignNetB)} />
        <StatTile label="Net Lokal" value={fmtB(data.localNetB)} color={signColor(data.localNetB)} />
        <StatTile label="Bias" value={String(data.flowBias ?? "N/A")} />
        <StatTile label="Broker aktif" value={fmtNum(data.brokerCount, 0)} />
      </div>
      {rows.length > 0 && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border-1)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => fmtNum(v, 0)} />
            <YAxis type="category" dataKey="broker" tick={axisTick} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine x={0} stroke="var(--border-2)" />
            <Tooltip cursor={{ fill: "var(--signal-dim)" }} content={<ChartTooltip
              formatter={(p: any) => `Net: ${fmtB(p.value)} (${p.payload.type})`} />} />
            <Bar dataKey="valueB" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
              {rows.map((r, i) => (
                <Cell key={i} fill={(r.valueB ?? 0) >= 0 ? "var(--positive)" : "var(--danger)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-4)", marginTop: 4 }}>
        Net broker (miliar IDR) · hijau = net beli, merah = net jual
      </div>
    </div>
  );
}

// ── layer_scores ──────────────────────────────────────────────
function LayerScoresWidget({ data }: { data: Record<string, any> }) {
  const layers: { key: string; label: string; score: number | null; weight: number }[] = data.layers ?? [];
  const rows = layers.map((l) => ({ ...l, score: l.score, plotted: l.score ?? 0 }));
  const color = actionColorVar(data.actionColor);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "var(--text-4)", textTransform: "uppercase" }}>
            Skor Komposit
          </div>
          <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color, lineHeight: 1.1 }}>
            {fmtNum(data.compositeScore, 0)}
            <span style={{ fontSize: 12, color: "var(--text-4)", fontWeight: 400 }}> /100</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {data.actionGuidance && <Chip text={String(data.actionGuidance)} color={color} />}
          {data.isGorengan && <Chip text="GORENGAN" color="var(--danger)" />}
          {data.hardOverride && <Chip text={String(data.hardOverride)} color="var(--danger)" />}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={layers.length * 26 + 10}>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="label" tick={axisTick} tickLine={false} axisLine={false} width={92} />
          <Tooltip cursor={{ fill: "var(--signal-dim)" }} content={<ChartTooltip
            formatter={(p: any) => p.payload.score == null
              ? "Tidak ada data (dikecualikan)"
              : `Skor: ${fmtNum(p.payload.score, 0)}/100 · bobot ${Math.round(p.payload.weight * 100)}%`} />} />
          <Bar dataKey="plotted" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}
            label={{
              position: "right", fontFamily: mono, fontSize: 10, fill: "var(--text-3)",
              formatter: (v: number) => (v === 0 ? "" : Math.round(v)),
            }}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.score == null ? "var(--surface-3)" : "var(--signal)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-4)", marginTop: 4 }}>
        Skor per layer (0-100) · abu-abu = data belum tersedia
      </div>
    </div>
  );
}

// ── market_overview ───────────────────────────────────────────
function MoverList({ title, rows }: { title: string; rows: { code: string; changePercent: number | null; valueB: number | null }[] }) {
  return (
    <div style={{ flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "var(--text-4)", textTransform: "uppercase", marginBottom: 4 }}>
        {title}
      </div>
      {rows.map((r) => (
        <div key={r.code} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontFamily: mono, fontSize: 11 }}>
          <span style={{ color: "var(--text-2)" }}>{r.code}</span>
          <span style={{ color: signColor(r.changePercent) }}>{fmtPct(r.changePercent)}</span>
        </div>
      ))}
    </div>
  );
}

function MarketOverviewWidget({ data }: { data: Record<string, any> }) {
  const indices: { code: string; value: number | null; percent: number | null }[] = data.indices ?? [];
  const macro = data.macro;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {indices.map((i) => (
          <StatTile key={i.code} label={i.code} value={`${fmtNum(i.value, 0)} · ${fmtPct(i.percent)}`} color={signColor(i.percent)} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: macro ? 12 : 0 }}>
        <MoverList title="Top Gainers" rows={data.gainers ?? []} />
        <MoverList title="Top Losers" rows={data.losers ?? []} />
        <MoverList title="Teraktif" rows={data.mostActive ?? []} />
      </div>
      {macro && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatTile label="USD/IDR" value={fmtNum(macro.usdIdr, 0)} />
          <StatTile label="Net Asing IHSG" value={fmtB(macro.ihsgForeignNetFlowB)} color={signColor(macro.ihsgForeignNetFlowB)} />
          {data.regime && <StatTile label="Regime" value={String(data.regime.regime).replace(/_/g, " ")} />}
        </div>
      )}
    </div>
  );
}

// ── fundamentals ──────────────────────────────────────────────
const VAL_COLORS: Record<string, string> = {
  MURAH: "var(--positive)", WAJAR: "var(--text-3)", MAHAL: "var(--danger)",
  KUAT: "var(--positive)", SEDANG: "var(--warning)", LEMAH: "var(--danger)",
};

function FundamentalsWidget({ data }: { data: Record<string, any> }) {
  const r = data.ratios ?? {};
  const tiles: [string, string][] = [
    ["PER", fmtNum(r.per)], ["PBV", fmtNum(r.pbv)], ["DER", fmtNum(r.der)],
    ["ROE", r.roe == null ? "N/A" : `${fmtNum(r.roe)}%`],
    ["ROA", r.roa == null ? "N/A" : `${fmtNum(r.roa)}%`],
    ["NPM", r.npm == null ? "N/A" : `${fmtNum(r.npm)}%`],
    ["EPS", fmtNum(r.eps)],
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {data.valuationLabel && data.valuationLabel !== "TIDAK_ADA_DATA" && (
          <Chip text={`Valuasi: ${data.valuationLabel}`} color={VAL_COLORS[data.valuationLabel] ?? "var(--text-3)"} />
        )}
        {data.qualityLabel && data.qualityLabel !== "TIDAK_ADA_DATA" && (
          <Chip text={`Kualitas: ${data.qualityLabel}`} color={VAL_COLORS[data.qualityLabel] ?? "var(--text-3)"} />
        )}
        {data.relativePE != null && (
          <Chip text={`PER ${fmtNum(data.relativePE, 2)}x rata-rata sektor`} color="var(--text-3)" />
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tiles.map(([label, value]) => <StatTile key={label} label={label} value={value} />)}
      </div>
      {r.fsDate && (
        <div style={{ fontFamily: mono, fontSize: 10, color: "var(--text-4)", marginTop: 6 }}>
          Laporan keuangan per {String(r.fsDate).slice(0, 10)} · sumber IDX
        </div>
      )}
    </div>
  );
}

// ── themes ────────────────────────────────────────────────────
const DIR_COLORS: Record<string, string> = {
  POSITIF: "var(--positive)", NEGATIF: "var(--danger)", NETRAL: "var(--text-3)",
};

function ThemesWidget({ data }: { data: Record<string, any> }) {
  const themes: { title: string; category: string | null; summary: string | null; confidence: string | null }[] = data.themes ?? [];
  const flags: { symbol: string; theme: string | null; direction: string | null }[] = data.flags ?? [];
  return (
    <div>
      {themes.map((t, i) => (
        <div key={i} style={{
          padding: "8px 10px", borderRadius: 6, background: "var(--surface-2)",
          border: "1px solid var(--border-1)", marginBottom: 6,
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{t.title}</span>
            {t.category && <Chip text={t.category} color="var(--signal)" />}
          </div>
          {t.summary && (
            <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-3)", marginTop: 3, lineHeight: 1.5 }}>
              {t.summary}
            </div>
          )}
        </div>
      ))}
      {flags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {flags.map((f, i) => (
            <Chip key={i} text={f.symbol} color={DIR_COLORS[f.direction ?? "NETRAL"] ?? "var(--text-3)"} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Registry ──────────────────────────────────────────────────
export function ChatWidget({ widget }: { widget: ChatWidgetData }) {
  let body: React.ReactNode = null;
  switch (widget.type) {
    case "price_chart":     body = <PriceChartWidget data={widget.data} />; break;
    case "bandar_flow":     body = <BandarFlowWidget data={widget.data} />; break;
    case "layer_scores":    body = <LayerScoresWidget data={widget.data} />; break;
    case "market_overview": body = <MarketOverviewWidget data={widget.data} />; break;
    case "fundamentals":    body = <FundamentalsWidget data={widget.data} />; break;
    case "themes":          body = <ThemesWidget data={widget.data} />; break;
    default: return null;
  }
  return <WidgetCard title={widget.title}>{body}</WidgetCard>;
}

export function ChatWidgetList({ widgets }: { widgets: ChatWidgetData[] | null | undefined }) {
  if (!widgets || widgets.length === 0) return null;
  return <>{widgets.map((w) => <ChatWidget key={w.id} widget={w} />)}</>;
}

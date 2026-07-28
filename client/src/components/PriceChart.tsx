import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/contexts/ThemeContext";
import {
  createChart,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChartType = "candle" | "line" | "area" | "bar";
type IndicatorKey = "MA20" | "MA50" | "EMA9" | "EMA21" | "BB" | "VWAP" | "RSI" | "MACD" | "STOCH";
type DrawingTool =
  | "cursor"
  | "crosshair"
  | "trendline"
  | "horizontal"
  | "vertical"
  | "ray"
  | "fib"
  | "rect"
  | "text"
  | "measure"
  | "eraser";

interface OHLCVData {
  time: string | number; // 'YYYY-MM-DD' for daily; Unix seconds for intraday
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  data?: any[];
  symbol?: string;
}

// ─── Fallback data generator ──────────────────────────────────────────────────
function generateFallbackData(): OHLCVData[] {
  const result: OHLCVData[] = [];
  let price = 11000;
  const start = new Date("2024-09-01");
  for (let i = 0; i < 120; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * 220;
    const open = price;
    const close = Math.max(5000, Math.round(price + change));
    const high = Math.round(Math.max(open, close) * (1 + Math.random() * 0.008));
    const low = Math.round(Math.min(open, close) * (1 - Math.random() * 0.008));
    const volume = Math.floor(Math.random() * 80000000 + 10000000);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    result.push({ time: `${d.getFullYear()}-${mm}-${dd}`, open, high, low, close, volume });
    price = close;
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toOHLCV(data: any[]): OHLCVData[] {
  return (data || [])
    .map((d: any, i: number) => {
      const close = Number(d.close ?? d.value ?? d.price ?? 0);
      const prev = i > 0 ? Number(data[i - 1].close ?? data[i - 1].value ?? close) : close;
      const open = Number(d.open ?? prev);
      const high = Number(d.high ?? Math.max(open, close) * 1.003);
      const low = Number(d.low ?? Math.min(open, close) * 0.997);
      const volume = Number(d.volume ?? Math.floor(Math.random() * 50000000 + 5000000));
      const time = d.time ?? d.date ?? d.timestamp;
      if (!time || isNaN(close)) return null;
      return { time, open: Math.round(open), high: Math.round(high), low: Math.round(low), close: Math.round(close), volume };
    })
    .filter(Boolean) as OHLCVData[];
}

function calcSMA(data: OHLCVData[], period: number) {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const avg = data.slice(i - period + 1, i + 1).reduce((s, x) => s + x.close, 0) / period;
    return { time: d.time, value: Math.round(avg * 100) / 100 };
  }).filter(Boolean);
}

function calcEMA(data: OHLCVData[], period: number) {
  const k = 2 / (period + 1);
  let ema = data[0]?.close ?? 0;
  return data.map((d, i) => {
    if (i === 0) { ema = d.close; } else { ema = d.close * k + ema * (1 - k); }
    return { time: d.time, value: Math.round(ema * 100) / 100 };
  });
}

function calcBB(data: OHLCVData[], period = 20, mult = 2) {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((s, x) => s + x.close, 0) / period;
    const sd = Math.sqrt(slice.reduce((s, x) => s + (x.close - avg) ** 2, 0) / period);
    return {
      time: d.time,
      upper: Math.round((avg + mult * sd) * 10) / 10,
      mid: Math.round(avg * 10) / 10,
      lower: Math.round((avg - mult * sd) * 10) / 10,
    };
  }).filter(Boolean);
}

function calcRSI(data: OHLCVData[], period = 14) {
  let ag = 0, al = 0;
  return data.map((d, i) => {
    if (i === 0) return { time: d.time, value: 50 };
    const diff = d.close - data[i - 1].close;
    if (i <= period) { ag += diff > 0 ? diff : 0; al += diff < 0 ? -diff : 0; }
    else { ag = (ag * (period - 1) + (diff > 0 ? diff : 0)) / period; al = (al * (period - 1) + (diff < 0 ? -diff : 0)) / period; }
    const rs = al === 0 ? 100 : ag / al;
    return { time: d.time, value: Math.round((100 - 100 / (1 + rs)) * 100) / 100 };
  });
}

function calcEMAGeneric(data: { time: string | number; value: number }[], period: number) {
  const k = 2 / (period + 1);
  let ema = data[0]?.value ?? 0;
  return data.map((d, i) => {
    if (i === 0) { ema = d.value; } else { ema = d.value * k + ema * (1 - k); }
    return { time: d.time, value: Math.round(ema * 100) / 100 };
  });
}

function calcMACD(data: OHLCVData[]) {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macdLine = data.map((d, i) => ({ time: d.time, value: Math.round(((ema12[i]?.value ?? 0) - (ema26[i]?.value ?? 0)) * 100) / 100 }));
  const signalArr = calcEMAGeneric(macdLine, 9);
  const hist = macdLine.map((m, i) => ({ time: m.time, value: Math.round((m.value - (signalArr[i]?.value ?? 0)) * 100) / 100 }));
  return { macdLine, signalArr, hist };
}

function calcStoch(data: OHLCVData[], period = 14) {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const highMax = Math.max(...slice.map(x => x.high));
    const lowMin = Math.min(...slice.map(x => x.low));
    const k = highMax === lowMin ? 50 : Math.round(((d.close - lowMin) / (highMax - lowMin)) * 10000) / 100;
    return { time: d.time, value: k };
  }).filter(Boolean);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHART_DARK  = { bg: "#0a0a0a", grid: "#161616", text: "#8b8b94", border: "#222222" };
const CHART_LIGHT = { bg: "#ffffff", grid: "#eef2f7", text: "#475569", border: "#cbd5e1" };
// Each tab is a real candle RESOLUTION (TradingView-style) — not a lookback
// range with a fixed daily interval. "1M" means one candle per month, not
// "1 month of daily candles". Each maps to {interval sent to the OHLCV API,
// a sensible default history depth for that resolution}.
// "4H" has no native Yahoo interval — synthesized server-side from 1H bars
// (see server/engine/ohlcvFetcher.ts aggregateBars). Intraday intervals are
// capped by Yahoo's actual limits (1m ≤ 8d, 15m/30m ≤ 60d, 1h ≤ 730d).
const TIMEFRAMES = ["1m", "15m", "30m", "1H", "4H", "1D", "1M"];
const TIMEFRAME_CONFIG: Record<string, { interval: string; rangeDays: number }> = {
  "1m":  { interval: "1m",  rangeDays: 2 },
  "15m": { interval: "15m", rangeDays: 10 },
  "30m": { interval: "30m", rangeDays: 20 },
  "1H":  { interval: "1h",  rangeDays: 90 },
  "4H":  { interval: "4h",  rangeDays: 365 },
  "1D":  { interval: "1d",  rangeDays: 730 },
  "1M":  { interval: "1mo", rangeDays: 3650 },
};

const DRAWING_TOOLS: { key: DrawingTool; icon: string; label: string }[] = [
  { key: "cursor", icon: "↖", label: "Kursor" },
  { key: "crosshair", icon: "⊕", label: "Crosshair" },
  { key: "trendline", icon: "╱", label: "Garis Tren" },
  { key: "horizontal", icon: "─", label: "Garis Horizontal" },
  { key: "vertical", icon: "│", label: "Garis Vertikal" },
  { key: "ray", icon: "→", label: "Ray" },
  { key: "fib", icon: "ϕ", label: "Fibonacci" },
  { key: "rect", icon: "▭", label: "Rectangle" },
  { key: "text", icon: "T", label: "Teks" },
  { key: "measure", icon: "↔", label: "Ukur" },
  { key: "eraser", icon: "⌫", label: "Hapus" },
];

const INDICATORS: { key: IndicatorKey; label: string; color: string; group: string }[] = [
  { key: "MA20",  label: "MA 20",          color: "#f59e0b", group: "Overlay" },
  { key: "MA50",  label: "MA 50",          color: "#8b5cf6", group: "Overlay" },
  { key: "EMA9",  label: "EMA 9",          color: "#34d399", group: "Overlay" },
  { key: "EMA21", label: "EMA 21",         color: "#f97316", group: "Overlay" },
  { key: "BB",    label: "Bollinger Bands",color: "#6366f1", group: "Overlay" },
  { key: "VWAP",  label: "VWAP",           color: "#ec4899", group: "Overlay" },
  { key: "RSI",   label: "RSI (14)",       color: "#a78bfa", group: "Oscillator" },
  { key: "MACD",  label: "MACD",           color: "#38BDF8", group: "Oscillator" },
  { key: "STOCH", label: "Stochastic",     color: "#fb923c", group: "Oscillator" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function PriceChart({ data, symbol }: PriceChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const stochRef = useRef<HTMLDivElement>(null);
  const chartInst = useRef<IChartApi | null>(null);
  const { theme } = useTheme();
  const CHART = theme === "dark" ? CHART_DARK : CHART_LIGHT;

  const [chartType, setChartType] = useState<ChartType>("candle");
  const [activeInds, setActiveInds] = useState<Set<IndicatorKey>>(new Set());
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [activeTimeframe, setActiveTimeframe] = useState("1D");
  const [showIndPanel, setShowIndPanel] = useState(false);
  const [ohlc, setOhlc] = useState<{ o: number; h: number; l: number; c: number; chg: number; chgPct: number } | null>(null);

  // Fetch live OHLCV from Yahoo/IDX when a symbol is given and no data was passed in.
  // Re-fetches whenever the active timeframe tab changes (interval + range).
  const usesRemote = !!symbol && !(data && data.length > 0);
  const tfConfig = TIMEFRAME_CONFIG[activeTimeframe] ?? TIMEFRAME_CONFIG["1D"];
  const { data: fetched, isLoading } = useQuery<{ symbol: string; bars: OHLCVData[] }>({
    queryKey: ["/api/stocks", symbol, "ohlcv", tfConfig.interval, tfConfig.rangeDays],
    queryFn: async () => {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol!)}/ohlcv?range=${tfConfig.rangeDays}&interval=${tfConfig.interval}`);
      if (!res.ok) throw new Error("Failed to fetch OHLCV");
      return res.json();
    },
    enabled: usesRemote,
    staleTime: 5 * 60 * 1000,
  });

  // While real data for a symbol is still loading, do NOT flash synthetic
  // fallback candles — show a loading state instead. Fallback is only for the
  // demo case (no symbol) or when the fetch genuinely failed.
  const waitingForReal = usesRemote && isLoading && !fetched;

  const rawData =
    data && data.length > 0 ? data :
    fetched?.bars && fetched.bars.length > 0 ? fetched.bars :
    [];
  const ohlcv: OHLCVData[] =
    rawData.length > 0 ? toOHLCV(rawData) :
    waitingForReal ? [] :
    generateFallbackData();
  const displaySymbol = symbol || "DEMO";
  const noData = usesRemote && !waitingForReal && rawData.length === 0; // fetch done, empty/error

  useEffect(() => {
    if (ohlcv.length === 0) return;
    const last = ohlcv[ohlcv.length - 1];
    const prev = ohlcv.length > 1 ? ohlcv[ohlcv.length - 2] : last;
    setOhlc({
      o: last.open,
      h: last.high,
      l: last.low,
      c: last.close,
      chg: last.close - prev.close,
      chgPct: ((last.close - prev.close) / prev.close) * 100,
    });
  }, [data, fetched]);

  useEffect(() => {
    if (!mainRef.current || ohlcv.length === 0) return;

    const chart = createChart(mainRef.current, {
      layout: { background: { color: CHART.bg }, textColor: CHART.text, fontFamily: "Inter, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#444", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#333" },
        horzLine: { color: "#444", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#333" },
      },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.08, bottom: 0.18 } },
      timeScale: { borderColor: CHART.border, timeVisible: true, secondsVisible: false, barSpacing: 8 },
      width: mainRef.current.clientWidth,
      height: 420,
    });
    chartInst.current = chart;

    let mainSeries: ISeriesApi<any>;
    if (chartType === "candle") {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#26a69a", downColor: "#ef5350",
        borderUpColor: "#26a69a", borderDownColor: "#ef5350",
        wickUpColor: "#26a69a", wickDownColor: "#ef5350",
      });
      mainSeries.setData(ohlcv.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
    } else if (chartType === "bar") {
      mainSeries = chart.addSeries(BarSeries, { upColor: "#26a69a", downColor: "#ef5350" });
      mainSeries.setData(ohlcv.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
    } else if (chartType === "area") {
      mainSeries = chart.addSeries(AreaSeries, { lineColor: "#38BDF8", topColor: "#38BDF820", bottomColor: "#38BDF805", lineWidth: 2 });
      mainSeries.setData(ohlcv.map(d => ({ time: d.time, value: d.close })));
    } else {
      mainSeries = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 2, priceLineVisible: false });
      mainSeries.setData(ohlcv.map(d => ({ time: d.time, value: d.close })));
    }

    const volSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volSeries.setData(ohlcv.map(d => ({ time: d.time, value: d.volume, color: d.close >= d.open ? "#26a69a33" : "#ef535033" })) as any);

    if (activeInds.has("MA20")) {
      const s = chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, priceLineVisible: false, title: "MA20" });
      s.setData(calcSMA(ohlcv, 20) as any);
    }
    if (activeInds.has("MA50")) {
      const s = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, priceLineVisible: false, title: "MA50" });
      s.setData(calcSMA(ohlcv, 50) as any);
    }
    if (activeInds.has("EMA9")) {
      const s = chart.addSeries(LineSeries, { color: "#34d399", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, title: "EMA9" });
      s.setData(calcEMA(ohlcv, 9) as any);
    }
    if (activeInds.has("EMA21")) {
      const s = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, title: "EMA21" });
      s.setData(calcEMA(ohlcv, 21) as any);
    }
    if (activeInds.has("BB")) {
      const bb = calcBB(ohlcv);
      const bu = chart.addSeries(LineSeries, { color: "#6366f166", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
      bu.setData(bb.map((b: any) => ({ time: b.time, value: b.upper })));
      const bm = chart.addSeries(LineSeries, { color: "#6366f1", lineWidth: 1, priceLineVisible: false, title: "BB" });
      bm.setData(bb.map((b: any) => ({ time: b.time, value: b.mid })));
      const bl = chart.addSeries(LineSeries, { color: "#6366f166", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
      bl.setData(bb.map((b: any) => ({ time: b.time, value: b.lower })));
    }
    if (activeInds.has("VWAP")) {
      let cumPV = 0, cumVol = 0;
      const vwapData = ohlcv.map(d => {
        const typicalPrice = (d.high + d.low + d.close) / 3;
        cumPV += typicalPrice * d.volume;
        cumVol += d.volume;
        return { time: d.time, value: Math.round(cumPV / cumVol) };
      });
      const s = chart.addSeries(LineSeries, { color: "#ec4899", lineWidth: 1, lineStyle: LineStyle.LargeDashed, priceLineVisible: false, title: "VWAP" });
      s.setData(vwapData as any);
    }

    chart.subscribeCrosshairMove(param => {
      if (!param.point || !param.time) return;
      const idx = ohlcv.findIndex(d => d.time === param.time);
      if (idx >= 0) {
        const d = ohlcv[idx];
        const prev = idx > 0 ? ohlcv[idx - 1] : d;
        setOhlc({ o: d.open, h: d.high, l: d.low, c: d.close, chg: d.close - prev.close, chgPct: ((d.close - prev.close) / prev.close) * 100 });
      }
    });

    chart.timeScale().fitContent();

    const obs = new ResizeObserver(entries => {
      if (entries[0]) chart.applyOptions({ width: entries[0].contentRect.width });
    });
    obs.observe(mainRef.current);

    return () => { obs.disconnect(); chart.remove(); chartInst.current = null; };
  }, [chartType, activeInds, data, fetched, theme]);

  useEffect(() => {
    if (!rsiRef.current || !activeInds.has("RSI") || ohlcv.length === 0) return;
    const chart = createChart(rsiRef.current, {
      layout: { background: { color: CHART.bg }, textColor: CHART.text, fontSize: 10 },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: CHART.border, visible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: rsiRef.current.clientWidth,
      height: 110,
    });
    const rsiSeries = chart.addSeries(LineSeries, { color: "#a78bfa", lineWidth: 1, priceLineVisible: false });
    rsiSeries.setData(calcRSI(ohlcv) as any);
    const ob = chart.addSeries(LineSeries, { color: "#ef535055", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
    ob.setData(ohlcv.map(d => ({ time: d.time, value: 70 })) as any);
    const os = chart.addSeries(LineSeries, { color: "#26a69a55", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
    os.setData(ohlcv.map(d => ({ time: d.time, value: 30 })) as any);
    chart.timeScale().fitContent();
    const obs = new ResizeObserver(e => { if (e[0]) chart.applyOptions({ width: e[0].contentRect.width }); });
    obs.observe(rsiRef.current);
    return () => { obs.disconnect(); chart.remove(); };
  }, [activeInds, data, fetched, theme]);

  useEffect(() => {
    if (!macdRef.current || !activeInds.has("MACD") || ohlcv.length === 0) return;
    const chart = createChart(macdRef.current, {
      layout: { background: { color: CHART.bg }, textColor: CHART.text, fontSize: 10 },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: CHART.border, visible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: macdRef.current.clientWidth,
      height: 110,
    });
    const { macdLine, signalArr, hist } = calcMACD(ohlcv);
    const histSeries = chart.addSeries(HistogramSeries, { color: "#38BDF8", priceLineVisible: false });
    histSeries.setData(hist.map(d => ({ time: d.time, value: d.value, color: d.value >= 0 ? "#26a69a88" : "#ef535088" })) as any);
    const macdS = chart.addSeries(LineSeries, { color: "#38BDF8", lineWidth: 1, priceLineVisible: false });
    macdS.setData(macdLine as any);
    const sigS = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false });
    sigS.setData(signalArr as any);
    chart.timeScale().fitContent();
    const obs = new ResizeObserver(e => { if (e[0]) chart.applyOptions({ width: e[0].contentRect.width }); });
    obs.observe(macdRef.current);
    return () => { obs.disconnect(); chart.remove(); };
  }, [activeInds, data, fetched, theme]);

  useEffect(() => {
    if (!stochRef.current || !activeInds.has("STOCH") || ohlcv.length === 0) return;
    const chart = createChart(stochRef.current, {
      layout: { background: { color: CHART.bg }, textColor: CHART.text, fontSize: 10 },
      grid: { vertLines: { color: CHART.grid }, horzLines: { color: CHART.grid } },
      rightPriceScale: { borderColor: CHART.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: CHART.border, visible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: stochRef.current.clientWidth,
      height: 110,
    });
    const stochSeries = chart.addSeries(LineSeries, { color: "#fb923c", lineWidth: 1, priceLineVisible: false });
    stochSeries.setData(calcStoch(ohlcv) as any);
    const ob = chart.addSeries(LineSeries, { color: "#ef535055", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
    ob.setData(ohlcv.map(d => ({ time: d.time, value: 80 })) as any);
    const os = chart.addSeries(LineSeries, { color: "#26a69a55", lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false });
    os.setData(ohlcv.map(d => ({ time: d.time, value: 20 })) as any);
    chart.timeScale().fitContent();
    const obs = new ResizeObserver(e => { if (e[0]) chart.applyOptions({ width: e[0].contentRect.width }); });
    obs.observe(stochRef.current);
    return () => { obs.disconnect(); chart.remove(); };
  }, [activeInds, data, fetched, theme]);

  const toggleInd = (key: IndicatorKey) => {
    setActiveInds(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  };

  const chartTypes: { key: ChartType; label: string }[] = [
    { key: "candle", label: "🕯" },
    { key: "bar",    label: "▮" },
    { key: "line",   label: "∿" },
    { key: "area",   label: "◿" },
  ];

  const isPositive = (ohlc?.chg ?? 0) >= 0;

  return (
    <div className="flex rounded-lg border border-border/30 overflow-hidden bg-surface-1" style={{ minHeight: 520 }}>

      {/* ── Left Toolbar ── */}
      <div className="flex flex-col items-center gap-0.5 py-3 px-1.5 border-r border-border/20 bg-surface-2 shrink-0" style={{ width: 42 }}>
        {DRAWING_TOOLS.map((tool, i) => [
          (i === 2 || i === 6 || i === 9) && (
            <div key={`sep-${i}`} className="w-5 border-t border-border/20 my-1" />
          ),
          <button
            key={tool.key}
            title={tool.label}
            onClick={() => setActiveTool(tool.key)}
            data-testid={`button-tool-${tool.key}`}
            className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-all ${
              activeTool === tool.key
                ? "bg-signal text-surface-0"
                : "text-text-3 hover:text-text-1 hover:bg-white/5"
            }`}
          >
            {tool.icon}
          </button>,
        ])}
      </div>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Top Toolbar ── */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-border/20 bg-surface-2 shrink-0 flex-wrap">
          {/* Symbol + OHLC */}
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <span className="text-white font-bold">{displaySymbol}</span>
            <span className="text-text-3">·</span>
            <span className="text-text-3">{activeTimeframe}</span>
            <span className="text-text-3">·</span>
            <span className="text-text-3">IDX</span>
            {ohlc && (
              <>
                <span className="text-text-3 ml-1">O</span>
                <span className="text-white">{ohlc.o.toLocaleString("id-ID")}</span>
                <span className="text-text-3">H</span>
                <span className="text-[#26a69a]">{ohlc.h.toLocaleString("id-ID")}</span>
                <span className="text-text-3">L</span>
                <span className="text-[#ef5350]">{ohlc.l.toLocaleString("id-ID")}</span>
                <span className="text-text-3">C</span>
                <span className="text-white">{ohlc.c.toLocaleString("id-ID")}</span>
                <span className={isPositive ? "text-[#26a69a]" : "text-[#ef5350]"}>
                  {isPositive ? "+" : ""}{ohlc.chg.toLocaleString("id-ID")} ({isPositive ? "+" : ""}{ohlc.chgPct.toFixed(2)}%)
                </span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Chart type buttons */}
          <div className="flex items-center gap-0.5 border border-border/30 rounded p-0.5">
            {chartTypes.map(ct => (
              <button
                key={ct.key}
                title={ct.key}
                onClick={() => setChartType(ct.key)}
                data-testid={`button-charttype-${ct.key}`}
                className={`w-7 h-6 rounded text-sm transition-all ${chartType === ct.key ? "bg-signal text-surface-0" : "text-text-3 hover:text-text-1"}`}
              >
                {ct.label}
              </button>
            ))}
          </div>

          {/* Indicators button */}
          <div className="relative">
            <button
              onClick={() => setShowIndPanel(p => !p)}
              data-testid="button-indicators-panel"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold transition-all ${showIndPanel ? "border-signal text-signal bg-signal-dim" : "border-border/30 text-text-3 hover:text-text-1 hover:border-gray-500"}`}
            >
              <span>⊞</span> Indikator
              {activeInds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-signal text-surface-0 text-[10px] font-bold">{activeInds.size}</span>
              )}
            </button>

            {/* Indicators Panel Dropdown */}
            {showIndPanel && (
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-border/40 bg-surface-3 shadow-2xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border/20">
                  <p className="text-xs font-bold text-text-2 uppercase tracking-widest">Indikator</p>
                </div>
                {["Overlay", "Oscillator"].map(group => (
                  <div key={group}>
                    <div className="px-3 py-1.5 bg-surface-2">
                      <p className="text-[10px] font-bold text-text-4 uppercase tracking-widest">{group}</p>
                    </div>
                    {INDICATORS.filter(ind => ind.group === group).map(ind => (
                      <button
                        key={ind.key}
                        onClick={() => toggleInd(ind.key)}
                        data-testid={`button-indicator-${ind.key}`}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all hover:bg-white/5 ${activeInds.has(ind.key) ? "text-white" : "text-text-3"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ind.color }} />
                          <span className="font-medium">{ind.label}</span>
                        </div>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${activeInds.has(ind.key) ? "border-signal bg-signal text-surface-0" : "border-gray-600"}`}>
                          {activeInds.has(ind.key) ? "✓" : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="px-3 py-2 border-t border-border/20 flex justify-end">
                  <button
                    onClick={() => setActiveInds(new Set())}
                    data-testid="button-reset-indicators"
                    className="text-xs text-text-3 hover:text-red-400 transition-colors"
                  >
                    Reset Semua
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Main Chart ── */}
        <div className="relative w-full" style={{ height: 420 }}>
          <div ref={mainRef} className="w-full h-full" />
          {waitingForReal && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 text-text-3 text-xs tracking-widest uppercase">
              <span className="animate-pulse">Memuat data {displaySymbol}…</span>
            </div>
          )}
          {noData && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 text-text-4 text-xs tracking-widest uppercase">
              Data harga tidak tersedia
            </div>
          )}
        </div>

        {/* ── Sub-chart: RSI ── */}
        {activeInds.has("RSI") && (
          <div className="border-t border-border/20 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-2">
              <div className="w-2 h-2 rounded-full bg-[#a78bfa]" />
              <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest">RSI (14)</span>
              <span className="text-[10px] text-text-4">OB: 70 · OS: 30</span>
              <button onClick={() => toggleInd("RSI")} data-testid="button-close-rsi" className="ml-auto text-[10px] text-text-4 hover:text-red-400">✕</button>
            </div>
            <div ref={rsiRef} className="w-full" style={{ height: 110 }} />
          </div>
        )}

        {/* ── Sub-chart: MACD ── */}
        {activeInds.has("MACD") && (
          <div className="border-t border-border/20 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-2">
              <div className="w-2 h-2 rounded-full bg-signal" />
              <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest">MACD (12, 26, 9)</span>
              <span className="text-[10px] text-text-4">Biru: MACD · Oranye: Signal · Histogram</span>
              <button onClick={() => toggleInd("MACD")} data-testid="button-close-macd" className="ml-auto text-[10px] text-text-4 hover:text-red-400">✕</button>
            </div>
            <div ref={macdRef} className="w-full" style={{ height: 110 }} />
          </div>
        )}

        {/* ── Sub-chart: Stochastic ── */}
        {activeInds.has("STOCH") && (
          <div className="border-t border-border/20 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-2">
              <div className="w-2 h-2 rounded-full bg-[#fb923c]" />
              <span className="text-[10px] font-bold text-text-3 uppercase tracking-widest">Stochastic (14)</span>
              <span className="text-[10px] text-text-4">OB: 80 · OS: 20</span>
              <button onClick={() => toggleInd("STOCH")} data-testid="button-close-stoch" className="ml-auto text-[10px] text-text-4 hover:text-red-400">✕</button>
            </div>
            <div ref={stochRef} className="w-full" style={{ height: 110 }} />
          </div>
        )}

        {/* ── Bottom Timeframe Bar ── */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/20 bg-surface-2 shrink-0">
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                data-testid={`button-timeframe-${tf}`}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${activeTimeframe === tf ? "bg-signal text-surface-0" : "text-text-3 hover:text-text-1"}`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-4">
            {(["MA20", "MA50", "EMA9", "EMA21", "BB", "VWAP"] as IndicatorKey[])
              .filter(k => activeInds.has(k))
              .map(k => {
                const ind = INDICATORS.find(i => i.key === k);
                return ind ? (
                  <span key={k} className="flex items-center gap-1">
                    <span className="w-2 h-[2px] inline-block rounded" style={{ backgroundColor: ind.color }} />
                    <span style={{ color: ind.color }}>{ind.label}</span>
                  </span>
                ) : null;
              })}
          </div>
        </div>
      </div>
    </div>
  );
}

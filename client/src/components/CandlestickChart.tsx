import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts';

interface CandlestickChartProps {
  symbol: string;
  height?: number;
}

type TimePeriod = '1D' | '1W' | '1M' | '3M' | '1Y';

interface OHLCVBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeBar {
  time: string;
  value: number;
  color: string;
}

function generateDeterministicData(symbol: string, period: TimePeriod): { candlestickData: OHLCVBar[]; volumeData: VolumeBar[] } {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const barsMap: Record<TimePeriod, number> = { '1D': 78, '1W': 30, '1M': 60, '3M': 90, '1Y': 252 };
  const dataPoints = barsMap[period];

  let currentVal = 5000 + (seed % 10000);
  const candlestickData: OHLCVBar[] = [];
  const volumeData: VolumeBar[] = [];

  const now = new Date();

  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (dataPoints - i));
    const timeStr = date.toISOString().split('T')[0];

    const changePercent = ((seed + i * 13) % 7 - 3) / 100;
    const open = currentVal;
    const close = open * (1 + changePercent);
    const high = Math.max(open, close) * (1 + ((seed + i * 7) % 2) / 100);
    const low = Math.min(open, close) * (1 - ((seed + i * 11) % 2) / 100);

    candlestickData.push({ time: timeStr, open, high, low, close });

    const volume = 1000000 + ((seed * (i + 1)) % 5000000);
    volumeData.push({
      time: timeStr,
      value: volume,
      color: close >= open ? 'rgba(74,222,128,0.4)' : 'rgba(239,68,68,0.4)',
    });

    currentVal = close;
  }

  return { candlestickData, volumeData };
}

export function CandlestickChart({ symbol, height = 380 }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const [period, setPeriod] = useState<TimePeriod>('1M');

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0B0B0B' },
        textColor: '#8B8B8B',
      },
      grid: {
        vertLines: { color: '#1F1F1F' },
        horzLines: { color: '#1F1F1F' },
      },
      crosshair: {
        vertLine: { color: '#4ADE80', width: 1, style: 3, labelBackgroundColor: '#111111' },
        horzLine: { color: '#4ADE80', width: 1, style: 3, labelBackgroundColor: '#111111' },
      },
      rightPriceScale: {
        borderColor: '#1F1F1F',
      },
      timeScale: {
        borderColor: '#1F1F1F',
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#4ADE80',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#4ADE80',
      wickDownColor: '#EF4444',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    const { candlestickData, volumeData } = generateDeterministicData(symbol, period);
    candleSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [symbol, period]);

  return (
    <div className="bg-[#111111] border border-[#1F1F1F]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1F1F1F]">
        <div className="flex items-center gap-1">
          {(['1D', '1W', '1M', '3M', '1Y'] as TimePeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              data-testid={`button-period-${p}`}
              className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                period === p
                  ? 'bg-[#1F1F1F] text-[#4ADE80]'
                  : 'text-[#8B8B8B] hover:text-[#EAEAEA]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono text-[#8B8B8B]">
          {symbol} · IDX
        </span>
      </div>
      <div
        ref={containerRef}
        className="w-full"
        data-testid="candlestick-chart-container"
      />
    </div>
  );
}

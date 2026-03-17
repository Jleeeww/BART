import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CandlestickChartProps {
  symbol: string;
  height?: number;
}

type TimePeriod = '1D' | '1W' | '1M' | '3M' | '1Y';

/**
 * Deterministic data generator based on symbol name.
 * Starts in IDX-style range (5000-15000) and produces ~60 bars of fake data.
 */
function generateDeterministicData(symbol: string, period: TimePeriod): { candlestickData: CandlestickData[], volumeData: HistogramData[] } {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Deterministic "random" based on seed
  let currentVal = 5000 + (seed % 10000);
  const dataPoints = 60;
  const candlestickData: CandlestickData[] = [];
  const volumeData: HistogramData[] = [];

  const now = new Date();
  
  for (let i = 0; i < dataPoints; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (dataPoints - i));
    const timeStr = date.toISOString().split('T')[0] as Time;

    const changePercent = ((seed + i * 13) % 7 - 3) / 100; // -3% to +3%
    const open = currentVal;
    const close = open * (1 + changePercent);
    const high = Math.max(open, close) * (1 + (seed + i * 7) % 2 / 100);
    const low = Math.min(open, close) * (1 - (seed + i * 11) % 2 / 100);

    candlestickData.push({
      time: timeStr,
      open,
      high,
      low,
      close,
    });

    const volume = 1000000 + ((seed * (i + 1)) % 5000000);
    volumeData.push({
      time: timeStr,
      value: volume,
      color: close >= open ? 'rgba(74, 222, 128, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    });

    currentVal = close;
  }

  return { candlestickData, volumeData };
}

export const CandlestickChart = ({ symbol, height = 400 }: CandlestickChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('1M');

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0B0B0B' },
        textColor: '#8B8B8B',
      },
      grid: {
        vertLines: { color: '#1F1F1F' },
        horzLines: { color: '#1F1F1F' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        borderColor: '#1F1F1F',
      },
    });

    // @ts-ignore
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4ADE80',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#4ADE80',
      wickDownColor: '#EF4444',
    });

    // @ts-ignore
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // overlay
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const windowResizeHandler = () => {
      handleResize();
    };
    window.addEventListener('resize', windowResizeHandler);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      window.removeEventListener('resize', windowResizeHandler);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [height]);

  useEffect(() => {
    if (candlestickSeriesRef.current && volumeSeriesRef.current) {
      const { candlestickData, volumeData } = generateDeterministicData(symbol, period);
      candlestickSeriesRef.current.setData(candlestickData);
      volumeSeriesRef.current.setData(volumeData);
      chartRef.current?.timeScale().fitContent();
    }
  }, [symbol, period]);

  return (
    <Card className="p-4 bg-[#111111] border-[#1F1F1F] rounded-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(['1D', '1W', '1M', '3M', '1Y'] as TimePeriod[]).map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              className={`h-7 px-2 text-xs font-mono ${
                period === p ? 'bg-[#1F1F1F] text-[#4ADE80]' : 'text-[#8B8B8B]'
              }`}
              onClick={() => setPeriod(p)}
              data-testid={`button-period-${p}`}
            >
              {p}
            </Button>
          ))}
        </div>
        <div className="text-xs font-mono text-[#8B8B8B] uppercase">
          Live Market Data • {symbol}
        </div>
      </div>
      <div 
        ref={chartContainerRef} 
        className="w-full" 
        data-testid="candlestick-chart-container"
      />
    </Card>
  );
};

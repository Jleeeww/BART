export function detectTapeControl(p: any): boolean {
  const range = p.high - p.low;
  const tightRange = range / p.lastPrice < 0.005;
  const volumeHigh = p.volumeRatio > 1.5;
  const flowPositive = p.netFlow > 0;
  const stableVsFlow = p.lastPrice <= p.buyAvg * 1.005;

  return (
    tightRange &&
    volumeHigh &&
    flowPositive &&
    stableVsFlow
  );
}

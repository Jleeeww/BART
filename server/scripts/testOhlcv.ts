/**
 * Standalone smoke test for ohlcvFetcher — no DB, no API key required.
 * Run:  npx tsx server/scripts/testOhlcv.ts BBCA
 */
import { fetchYahooOHLCV, toYahooTicker } from '../engine/ohlcvFetcher';

async function main() {
  const symbol = process.argv[2] ?? 'BBCA';
  console.log(`Fetching OHLCV for ${symbol} (${toYahooTicker(symbol)}) ...\n`);

  const bars = await fetchYahooOHLCV(symbol, 30);
  if (bars.length === 0) {
    console.error('No bars returned — fetch failed or symbol invalid.');
    process.exit(1);
  }

  console.log(`Got ${bars.length} daily bars. Last 5:`);
  for (const b of bars.slice(-5)) {
    console.log(
      `${b.time}  O:${b.open}  H:${b.high}  L:${b.low}  C:${b.close}  V:${b.volume ?? 'n/a'}`
    );
  }

  const first = bars[0].close, last = bars[bars.length - 1].close;
  const pct = (((last - first) / first) * 100).toFixed(2);
  console.log(`\nRange move: ${first} -> ${last} (${pct}%)`);
}

main();

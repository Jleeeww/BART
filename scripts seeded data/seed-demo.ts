/**
 * seed-demo.ts — Manual demo seed CLI
 *
 * Usage:
 *   npm run seed:demo                        # seed all 5 stocks
 *   npm run seed:demo -- --symbol BBCA       # seed a single stock
 *   npm run seed:demo -- --symbol BBCA BMRI  # seed multiple stocks
 *
 * Requires MANAGEMENT_TOKEN env var (same as server).
 * Requires server running on PORT (default 3000).
 */

import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const SEED_DIR  = path.join(__dirname, '../server/seed-data');
const BASE_URL  = `http://localhost:${process.env.PORT ?? 3000}`;
const TOKEN     = process.env.MANAGEMENT_TOKEN;

if (!TOKEN) {
  console.error('ERROR: MANAGEMENT_TOKEN env var required');
  process.exit(1);
}

// Parse --symbol args
const args    = process.argv.slice(2);
const symIdx  = args.indexOf('--symbol');
const symbols: string[] = symIdx >= 0
  ? args.slice(symIdx + 1).filter(s => !s.startsWith('-')).map(s => s.toUpperCase())
  : [];

const ALL_SEEDS = ['BBCA', 'BMRI', 'ASII', 'GOTO', 'BREN'];
const targets   = symbols.length > 0 ? symbols : ALL_SEEDS;

async function seedOne(symbol: string): Promise<void> {
  const file = path.join(SEED_DIR, `${symbol}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`[${symbol}] No seed file at ${file} — skipping`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

  const res = await fetch(`${BASE_URL}/api/admin/seed-broker-data`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[${symbol}] HTTP ${res.status}: ${err}`);
    return;
  }

  const result = await res.json() as {
    symbol:          string;
    composite:       { before: number; after: number; delta: number; bucketBefore: string; bucketAfter: string };
    extensionScores: { M17before: number | null; M17after: number | null; M18: null; M24: null };
    activeFlags:     string[];
    message:         string;
  };

  console.log(`[${symbol}] ${result.message}`);
  console.log(`  Bucket: ${result.composite.bucketBefore} → ${result.composite.bucketAfter}`);
  if (result.extensionScores.M17after !== null) {
    console.log(`  M17: ${result.extensionScores.M17before ?? 'null'} → ${result.extensionScores.M17after}`);
  }
  if (result.activeFlags.length > 0) {
    console.log(`  Flags: ${result.activeFlags.join(', ')}`);
  }
}

console.log(`Seeding ${targets.join(', ')} → ${BASE_URL}`);
for (const sym of targets) {
  await seedOne(sym);
}
console.log('Done.');

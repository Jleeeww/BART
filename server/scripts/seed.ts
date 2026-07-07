/**
 * ============================================================
 * TIMESTAMPED SEED RUNNER
 * ============================================================
 * server/scripts/seed.ts
 *
 * Migration-style seeding. Each seed lives in `seeds/` named
 *   <YYYYMMDDHHMMSS>_<slug>.seed.ts
 * and exports `async function up(pool)`. Files run in timestamp
 * order; each successful run is recorded in the `_seed_history`
 * table so it never runs twice.
 *
 * Usage:
 *   pnpm run seed                    # apply all pending seeds
 *   pnpm run seed -- --only=<name>   # apply one seed by name (no .seed.ts)
 *   pnpm run seed -- --force         # re-apply ALL seeds
 *   pnpm run seed -- --status        # list applied vs pending, then exit
 *
 * Create a new seed:  pnpm run seed:new "add sector benchmarks"
 */
import { pool } from '../db';
import { readdirSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

const SEEDS_DIR = path.resolve(process.cwd(), 'seeds');

async function ensureHistoryTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _seed_history (
      id         serial PRIMARY KEY,
      name       text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedMap(): Promise<Map<string, Date>> {
  const { rows } = await pool.query<{ name: string; applied_at: Date }>(
    'SELECT name, applied_at FROM _seed_history'
  );
  return new Map(rows.map(r => [r.name, r.applied_at]));
}

function seedFiles(): string[] {
  if (!existsSync(SEEDS_DIR)) return [];
  return readdirSync(SEEDS_DIR)
    .filter(f => f.endsWith('.seed.ts'))
    .sort(); // timestamp prefix guarantees chronological order
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const status = args.includes('--status');
  const only = args.find(a => a.startsWith('--only='))?.split('=')[1];

  await ensureHistoryTable();
  const applied = await appliedMap();
  const files = seedFiles();

  if (status) {
    console.log('[seed] Seed status:\n');
    for (const f of files) {
      const name = f.replace(/\.seed\.ts$/, '');
      const at = applied.get(name);
      console.log(at ? `  ✓ ${name}   (applied ${at.toISOString()})` : `  · ${name}   (pending)`);
    }
    if (files.length === 0) console.log('  (no seed files in seeds/)');
    await pool.end();
    return;
  }

  const pending = files.filter(f => {
    const name = f.replace(/\.seed\.ts$/, '');
    if (only) return name === only;
    return force || !applied.has(name);
  });

  if (pending.length === 0) {
    console.log('[seed] Nothing to apply — all seeds up to date.');
    await pool.end();
    return;
  }

  for (const file of pending) {
    const name = file.replace(/\.seed\.ts$/, '');
    const mod = await import(pathToFileURL(path.join(SEEDS_DIR, file)).href);
    if (typeof mod.up !== 'function') {
      console.warn(`[seed] ⚠ ${name} has no exported up() — skipped`);
      continue;
    }
    const t0 = Date.now();
    console.log(`[seed] ▶ ${name} ...`);
    await mod.up(pool);
    await pool.query(
      `INSERT INTO _seed_history (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET applied_at = now()`,
      [name]
    );
    console.log(`[seed] ✓ ${name}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log(`\n[seed] Done. Applied ${pending.length} seed(s).`);
  await pool.end();
}

main().catch(err => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});

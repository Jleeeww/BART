/**
 * Scaffolds a new timestamped seed file in seeds/.
 * Usage:  pnpm run seed:new "add sector benchmarks"
 *   -> seeds/20260706143012_add-sector-benchmarks.seed.ts
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const SEEDS_DIR = path.resolve(process.cwd(), 'seeds');

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seed';
}

const desc = process.argv.slice(2).join(' ');
if (!desc) {
  console.error('Usage: pnpm run seed:new "short description"');
  process.exit(1);
}

if (!existsSync(SEEDS_DIR)) mkdirSync(SEEDS_DIR, { recursive: true });

const name = `${stamp()}_${slugify(desc)}`;
const file = path.join(SEEDS_DIR, `${name}.seed.ts`);

const template = `/**
 * Seed: ${desc}
 * Created: ${new Date().toISOString()}
 */
import type { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  // TODO: write your seed logic. Example:
  // await pool.query('INSERT INTO stocks (symbol, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['XXXX', 'Example']);
  throw new Error('seed "${name}" not implemented yet');
}
`;

writeFileSync(file, template);
console.log(`Created seeds/${name}.seed.ts`);

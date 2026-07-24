/**
 * Seed: LQ45 stock universe (initial population of the `stocks` table).
 * Wraps the existing server/scripts/seedLQ45.ts logic so it is tracked
 * by the timestamped seed runner.
 */
import type { Pool } from 'pg';
import { seedLQ45Stocks } from '../server/scripts/seedLQ45';

export async function up(_pool: Pool): Promise<void> {
  await seedLQ45Stocks();
}

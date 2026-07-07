# Seeds (timestamped)

Migration-style seeding. Each seed runs **once**, in timestamp order, and is
recorded in the `_seed_history` table so re-running is safe.

## File convention

```
seeds/<YYYYMMDDHHMMSS>_<slug>.seed.ts
```

Each file exports an `up(pool)` function:

```ts
import type { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  await pool.query('INSERT INTO ... ON CONFLICT DO NOTHING', [...]);
}
```

The timestamp prefix controls order (lexical sort = chronological). Never
rename a seed after it has been applied — the runner tracks it by filename.

## Commands

| Command | What it does |
|---|---|
| `pnpm run seed` | Apply all pending seeds |
| `pnpm run seed -- --status` | Show applied vs pending |
| `pnpm run seed -- --only=<name>` | Apply one seed (name without `.seed.ts`) |
| `pnpm run seed -- --force` | Re-apply every seed |
| `pnpm run seed:new "description"` | Scaffold a new timestamped seed file |

## Notes

- The runner is `server/scripts/seed.ts`; history table is `_seed_history`.
- `20260706120000_lq45-universe.seed.ts` wraps the LQ45 population (same data
  as the legacy `pnpm run seed:lq45`, now tracked).

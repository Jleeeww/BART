# BART Data Status

## Layer Status

| Layer | Source | Status | Notes |
|---|---|---|---|
| Bandarmology (L1) | `stocks.broker_data` | **DEMO** | Manually seeded via `/api/admin/seed-broker-data` |
| News Intelligence (L2) | RSS feeds → Claude | **LIVE** | Kontan, CNBC ID, Detik, Bisnis, Tempo — 15min cycle |
| Fundamental (L3) | `stocks` table | **STATIC** | Seed data; update via Drizzle |
| Management (L4) | Claude web search | **LIVE** (costs money) | POST `/api/management/:symbol/research` |
| Insider Activity (L5) | Claude web search | **LIVE** (costs money) | POST `/api/insider/:symbol/research` |
| Valuation (L6) | Computed from fundamentals | **LIVE** | Derived from L3 |
| Macro/Sector (L7) | `macro_context` table | **LIVE** | Updated 06:00 + 16:30 WIB |

## Broker Data — Demo Mode

Live scraping of IDX and Stockbit is blocked by Cloudflare (HTTP 503). The broker data currently in `stocks.broker_data` is from the static seed (inserted at project setup).

### Seeding broker data for demos

**Option A — CLI (seeds all 5 demo stocks):**
```bash
npm run seed:demo
```

**Option B — Single stock:**
```bash
npm run seed:demo -- --symbol BBCA
```

**Option C — Admin UI:**
Open `http://localhost:3000/admin/seed` in browser. Enter token from `MANAGEMENT_TOKEN` env var.

**Option D — Direct API:**
```bash
curl -X POST http://localhost:3000/api/admin/seed-broker-data \
  -H "Authorization: Bearer $MANAGEMENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @server/seed-data/BBCA.json
```

### Seed files

| File | Symbol | Pattern | Expected M17 Signal |
|---|---|---|---|
| `server/seed-data/BBCA.json` | BBCA | Accumulation | High (smart money buying) |
| `server/seed-data/BMRI.json` | BMRI | Mild accumulation | Moderate |
| `server/seed-data/ASII.json` | ASII | Mixed / neutral | Neutral (~50) |
| `server/seed-data/GOTO.json` | GOTO | Distribution warning | Low → SMART_MONEY_EXIT flag |
| `server/seed-data/BREN.json` | BREN | Gorengan / retail pump | Retail-heavy, low smart score |

### Demo badge

When `stocks.scrape_source = 'MANUAL_SEED'`, the **Flow Broker** tab shows a yellow **DEMO** badge to signal that the data was manually injected.

### Re-enabling live scraping

When IDX/Stockbit Cloudflare blocks are resolved, uncomment the three `scheduleDaily` calls in `server/index.ts` (search for "DEMO MODE: Broker scrape schedulers disabled").

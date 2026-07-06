# BART Codebase Audit v3.4

**Date:** 2026-05-20  
**Auditor:** Claude Sonnet 4.6 (read-only, no files modified)  
**Scope:** `/Users/Jleeeww/BART/server`, `/Users/Jleeeww/BART/client/src`, `/Users/Jleeeww/BART/shared/schema.ts`

---

## PART 1 — FILE INVENTORY

### Summary Counts

| Category | Count |
|---|---|
| Server engine files | 39 |
| Server non-engine (routes, db, storage, index, static, vite, scripts, scrapers, routes/sub) | 12 |
| Client pages | 9 |
| Client components (non-ui) | 14 |
| Client components/ui (shadcn) | 30 |
| Client lib/hooks/contexts | 6 |
| **Total audited** | **110** |

---

### Group A — Active Core (imported by 5+ files)

| File | Lines | Key Exports | Import Count |
|---|---|---|---|
| `server/engine/bandarmologyCore.ts` | 1,471 | `parseIDR`, `computeComposite`, `computeBandarmologyV2`, `BandarmologyInput`, `BandarmologyV2Result`, `clamp`, `safe_normalize`, `linear_slope`, `validateInputs`, `getLiquidityTier`, `computeM6/M8/M11/M12/M14/M15/M16` | 7 (bandarmologyExtensions, bandarmologyDecisionV2, buildBandarmologyInput, valuationEngine, unifiedDecision, radarEngine, routes/testBandarmology) |
| `server/engine/buildBandarmologyInput.ts` | 325 | `buildBandarmologyInput`, `RawStockRecord` | 4 (unifiedDecision, radarEngine, routes.ts, routes/testBandarmology) |
| `server/engine/unifiedDecision.ts` | 370 | `getStockDecision`, `mapStockDataToInput` | 2 (routes.ts, runTests.ts) |
| `client/src/lib/queryClient.ts` | 57 | `queryClient`, `apiRequest` | 4 (App.tsx, RadarPage, WatchlistPage, ScreenerPage, SimulationContext) |
| `shared/schema.ts` | 332 | `stocks`, `watchlist`, `sessionHistory`, `signalLifecycle`, `newsImpacts`, `managementProfiles`, `ragDocuments`, `simulationAuditLog`, `historicalSnapshots` | 5+ (routes.ts, storage.ts, db.ts-via-drizzle, engine files) |

---

### Group B — Active Feature (imported by 1-4 files)

| File | Lines | Imported By |
|---|---|---|
| `server/engine/compositeEngineV3.ts` | 397 | routes.ts, runTests.ts |
| `server/engine/insiderScorer.ts` | 297 | compositeEngineV3.ts, runTests.ts (+ dynamic in routes.ts, index.ts) |
| `server/engine/insiderResearch.ts` | 295 | insiderScorer.ts, runTests.ts (+ dynamic in routes.ts, index.ts) |
| `server/engine/managementResearch.ts` | 304 | managementScorer.ts (+ dynamic in routes.ts) |
| `server/engine/managementScorer.ts` | 240 | compositeEngineV3.ts (+ dynamic in routes.ts) |
| `server/engine/ragEngine.ts` | 242 | routes.ts, outcomeTracker.ts (+ dynamic in index.ts) |
| `server/engine/valuationEngine.ts` | 275 | routes.ts, compositeEngineV3.ts, synthesisEngine.ts |
| `server/engine/valuationModifier.ts` | 102 | routes.ts |
| `server/engine/synthesisEngine.ts` | 184 | routes.ts (dynamic), valuationEngine.ts (type import) |
| `server/engine/bandarmologyExtensions.ts` | 507 | routes.ts (computeM17), brokerRegistry.ts (classifyBrokers) |
| `server/engine/bandarmologyDecisionV2.ts` | 148 | radarEngine.ts, unifiedDecision.ts |
| `server/engine/radarEngine.ts` | 388 | routes.ts (dynamic), idxIngester.ts |
| `server/engine/gorenganDetector.ts` | 240 | bandarmologyCoreV1.ts (re-export), radarEngine.ts |
| `server/engine/lq45Universe.ts` | 13 | gorenganDetector.ts |
| `server/engine/macroRegimeDetector.ts` | 204 | compositeEngineV3.ts, runTests.ts, index.ts (dynamic) |
| `server/engine/macroContext.ts` | 337 | compositeEngineV3.ts (+ dynamic in routes.ts) |
| `server/engine/newsRouter.ts` | 272 | compositeEngineV3.ts (+ dynamic in routes.ts) |
| `server/engine/newsFetcher.ts` | 338 | newsAnalyzer.ts (+ dynamic in routes.ts, index.ts) |
| `server/engine/newsAnalyzer.ts` | 337 | newsRouter.ts |
| `server/engine/macroCausalKnowledge.ts` | 289 | newsAnalyzer.ts |
| `server/engine/sectorRotationEngine.ts` | 292 | routes.ts (dynamic only) |
| `server/engine/distributionWarning.ts` | 360 | routes.ts (dynamic only) |
| `server/engine/backtestEngine.ts` | 217 | radarEngine.ts, signalLifecycle.ts |
| `server/engine/signalLifecycle.ts` | 243 | backtestEngine.ts (+ dynamic in routes.ts) |
| `server/engine/scoreMonitor.ts` | 121 | radarEngine.ts, backtestEngine.ts (+ dynamic in routes.ts) |
| `server/engine/historyBuilder.ts` | 239 | idxIngester.ts (+ dynamic in routes.ts) |
| `server/engine/idxIngester.ts` | 209 | routes.ts (dynamic) |
| `server/engine/macroFlowFetcher.ts` | 191 | index.ts (dynamic) |
| `server/engine/outcomeTracker.ts` | 187 | index.ts (dynamic) |
| `server/engine/altDataFetcher.ts` | 471 | index.ts (dynamic), routes.ts (dynamic, 2x) |
| `server/engine/costTracker.ts` | 174 | index.ts (dynamic) |
| `server/engine/brokerRegistry.ts` | 158 | bandarmologyExtensions.ts |
| `server/engine/bandarmologyHistory.ts` | 313 | radarEngine.ts, routes/testBandarmology.ts |
| `server/engine/foreignParser.ts` | 30 | unifiedDecision.ts, bandarmologyCoreV1.ts, gorenganDetector.ts |
| `server/engine/flowQuality.ts` | 45 | unifiedDecision.ts, bandarmologyCoreV1.ts |
| `server/engine/insider.ts` | 22 | unifiedDecision.ts, bandarmologyCoreV1.ts |
| `server/engine/brokerStability.ts` | 56 | unifiedDecision.ts |
| `server/engine/runTests.ts` | 271 | routes.ts |
| `server/routes/testBandarmology.ts` | 303 | routes.ts (mounted as router) |
| `server/scrapers/brokerIngestor.ts` | 199 | routes.ts (dynamic), uses idxBrokerScraper + stockbitBrokerScraper |
| `server/scrapers/idxBrokerScraper.ts` | 328 | brokerIngestor.ts |
| `server/scrapers/stockbitBrokerScraper.ts` | 247 | brokerIngestor.ts |
| `server/storage.ts` | 102 | routes.ts, buildBandarmologyInput.ts, routes/testBandarmology.ts |
| `server/db.ts` | 15 | routes.ts, storage.ts, backtestEngine.ts, historyBuilder.ts, signalLifecycle.ts, distributionWarning.ts |
| `server/index.ts` | 218 | Entry point |
| `server/routes.ts` | 3,445 | Imported by index.ts |
| `server/static.ts` | 19 | index.ts |
| `server/vite.ts` | 58 | index.ts (dev only) |
| `server/scripts/seedLQ45.ts` | 916 | Standalone script only |
| `client/src/App.tsx` | 99 | Entry point |
| `client/src/pages/StockDashboard.tsx` | 2,175 | Routed from App.tsx |
| `client/src/pages/Homepage.tsx` | 750 | Routed from App.tsx |
| `client/src/pages/PasarPage.tsx` | 1,423 | Routed from App.tsx |
| `client/src/pages/WatchlistPage.tsx` | 1,019 | Routed from App.tsx |
| `client/src/pages/RadarPage.tsx` | 618 | Routed from App.tsx |
| `client/src/pages/ScreenerPage.tsx` | 935 | Routed from App.tsx |
| `client/src/pages/BeritaPage.tsx` | 648 | Routed from App.tsx |
| `client/src/pages/AdminSeed.tsx` | 340 | Routed from App.tsx |
| `client/src/pages/not-found.tsx` | 21 | Routed from App.tsx |
| `client/src/components/Sidebar.tsx` | 437 | App.tsx |
| `client/src/components/StatusCard.tsx` | 153 | StockDashboard.tsx |
| `client/src/components/LayerBreakdown.tsx` | 172 | StockDashboard.tsx |
| `client/src/components/StockHeader.tsx` | 100 | StockDashboard.tsx |
| `client/src/components/AIStockSummary.tsx` | Unknown | StockDashboard.tsx |
| `client/src/components/PriceChart.tsx` | 602 | StockDashboard.tsx |
| `client/src/components/MetricCard.tsx` | Unknown | StockDashboard.tsx |
| `client/src/components/ScoreRing.tsx` | 110 | StatusCard.tsx |
| `client/src/components/DecisionBadge.tsx` | 51 | StatusCard.tsx |
| `client/src/components/SimulationBanner.tsx` | 108 | App.tsx |
| `client/src/components/v3/BODMemberCard.tsx` | 105 | StockDashboard.tsx |
| `client/src/components/v3/NewsArticleCard.tsx` | 240 | StockDashboard.tsx, BeritaPage.tsx |
| `client/src/components/v3/ScoreRing.tsx` | 76 | StockDashboard.tsx |
| `client/src/contexts/SimulationContext.tsx` | 126 | App.tsx, SimulationBanner.tsx, SimulationToggle.tsx |
| `client/src/hooks/use-stocks.ts` | 22 | StockDashboard.tsx |
| `client/src/lib/utils.ts` | 6 | Many UI components |

---

### Group C — Legacy Active (still imported, but v1 logic)

| File | Lines | Issue |
|---|---|---|
| `server/engine/bandarmologyCoreV1.ts` | 1,553 | V1 engine. Still imported by routes.ts (lines 8: `computeBandarmology`, `buildBandarmologyInput`, `computeGorenganFromStock`). Contains internal `detectGorengan()` that duplicates `gorenganDetector.ts`. Wraps newer gorenganDetector but re-exports stale `computeGorenganFromStock`. |
| `server/engine/parseBrokerIDR.ts` | 9 | Thin file, only 9 lines. Duplicates logic already in `brokerStability.ts` (line 1-9) and `bandarmologyCore.ts` (line 146-156). Imported by bandarmologyCoreV1.ts and gorenganDetector.ts. |

---

### Group D — Orphan (zero external imports)

| File | Lines | Reason Likely Orphaned |
|---|---|---|
| `server/engine/newsClassifier.ts` | 27 | `classifyNewsBehavior()` exported but never imported anywhere. Was used in routes.ts for an earlier news classification experiment (now inline in routes.ts lines ~1291+). |
| `server/engine/tapeControl.ts` | 14 | `detectTapeControl()` is imported by `gorenganDetector.ts` (confirmed active). **Reclassify: this is active.** See correction in Part 3. |
| `server/engine/phaseDetection.ts` | 22 | `detectPhase()` exported. Imported by `bandarmologyCoreV1.ts` (legacy). Zero imports from v2+ pipeline. |
| `client/src/components/MiniSparkline.tsx` | ~30 | Exported but never imported in any page or component. |
| `client/src/components/SimulationToggle.tsx` | ~30 | Exported, imports `useSimulation` from SimulationContext, but never imported in any page or App.tsx. |
| `client/src/components/v3/DecisionBadge.tsx` | 51 | Listed in v3/index.ts but never imported directly in any page. |
| `client/src/components/v3/LayerBreakdown.tsx` | 165 | Listed in v3/index.ts but never imported in any page (StockDashboard uses `@/components/LayerBreakdown` — the non-v3 version). |
| `client/src/components/v3/StockListRow.tsx` | 119 | Listed in v3/index.ts but never imported in any page. |
| `client/src/components/v3/CommodityCard.tsx` | 79 | Listed in v3/index.ts but never imported in any page. |
| `client/src/lib/aiAnalysis.ts` | 55 | Exported functions never imported in any page or component. |

**Correction on tapeControl.ts:** `detectTapeControl` is imported by `gorenganDetector.ts` at line 3. It is active (Group B), not orphaned.

---

### Group E — Scripts

| File | Lines | Referenced In |
|---|---|---|
| `server/scripts/seedLQ45.ts` | 916 | `package.json` `seed:lq45` script |

---

## PART 2 — ENGINE VERSION OVERLAP

### Version Map

| Version | File | Status |
|---|---|---|
| v1.1 | `server/engine/bandarmologyCoreV1.ts` | LEGACY ACTIVE — still imported by routes.ts |
| v2.0 | `server/engine/bandarmologyCore.ts` | ACTIVE CORE — canonical math primitives, used by v3+ |
| v3.0 | `server/engine/compositeEngineV3.ts` | ACTIVE — the 7-layer composite (v3.3 header comment) |
| v3.1 | `server/engine/bandarmologyExtensions.ts` | ACTIVE — M17/M18/M24 extension models |
| v3.2 | `server/engine/insiderScorer.ts` | ACTIVE — insider scoring layer |
| v3.3 | `server/engine/macroRegimeDetector.ts` | ACTIVE — macro multiplier layer |
| v3.4 | `server/engine/lq45Universe.ts` + `gorenganDetector.ts` | ACTIVE — canonical LQ45 set + improved gorengan |

---

### Routes Calling v1.1 When v3.x Is Available

**`server/routes.ts` line 8:**
```ts
import { computeBandarmology, buildBandarmologyInput, computeGorenganFromStock } from "./engine/bandarmologyCoreV1";
```

- `computeBandarmology` (v1.1) is called at **routes.ts line ~1917** inside `/api/simulation/run`. The simulation handler uses v1.1 directly and separately from the v3 pipeline.
- `buildBandarmologyInput` from v1.1 is NOT the one used by the main pipeline. The main pipeline uses `buildBandarmologyInput` from `buildBandarmologyInput.ts` (imported by `unifiedDecision.ts`). The v1 import in routes.ts is a different, older implementation.
- `computeGorenganFromStock` from v1.1 re-exports from `gorenganDetector.ts` (confirmed at bandarmologyCoreV1.ts lines 35, 364-377). This means routes.ts could import directly from `gorenganDetector.ts` and eliminate the v1 dependency.

**Double-analysis problem:** In `/api/simulation/run`, stocks are analyzed using v1.1 `computeBandarmology` AND v3 `computeCompositeV3` (imported at routes.ts line 12). The same stock gets scored twice through incompatible engines. The simulation result at line ~1917 uses v1 score, while `computeCompositeV3` is called separately in routes.ts lines ~1483.

---

### v3 Engine Call Chain (Production Path)

```
GET /api/stocks → getStockDecision() [unifiedDecision.ts]
                    → buildBandarmologyInput() [buildBandarmologyInput.ts]
                    → computeBandarmologyV2() [bandarmologyCore.ts v2]
                    → getBandarmologyDecisionV2() [bandarmologyDecisionV2.ts]

GET /api/valuation/:symbol → computeCompositeV3() [compositeEngineV3.ts v3.0]
                               reads: insiderScorer cache
                               reads: macroRegimeDetector cache  
                               reads: macroContext cache
                               reads: newsRouter modifier
                               reads: managementScorer cache
                               reads: valuationEngine
```

---

## PART 3 — DUPLICATE / OVERLAPPING LOGIC

### 3a — IDR Parsing (4 implementations)

| Location | Function | Lines | Used By |
|---|---|---|---|
| `server/engine/bandarmologyCore.ts:146` | `parseIDR()` | exported, 10 lines | bandarmologyExtensions, buildBandarmologyInput, testBandarmology router |
| `server/engine/parseBrokerIDR.ts:1` | `parseBrokerIDR()` | exported, 9 lines | gorenganDetector, bandarmologyCoreV1 |
| `server/engine/brokerStability.ts:1` | `parseBrokerIDR()` | exported, 9 lines | brokerStability (internal) |
| `server/engine/foreignParser.ts:1` | `parseIDR()` (unexported, local) | 5 lines | foreignParser (internal only) |

**Verdict:** `bandarmologyCore.ts`'s `parseIDR` is the most complete (handles T/B/M/K, comma stripping, null safety). `parseBrokerIDR.ts` and `brokerStability.ts` export identically-named functions with identical logic. `foreignParser.ts` has a simplified local-only version. **Canonical = `bandarmologyCore.ts:parseIDR`.**

---

### 3b — LQ45 Stock Lists (3 locations)

| Location | Type | Stocks |
|---|---|---|
| `server/engine/lq45Universe.ts:6` | `LQ45_UNIVERSE` Set (exported) | 45 symbols — **canonical** |
| `server/routes.ts:681` | `HOMEPAGE_UNIVERSE` array (inline constant) | 46 symbols — 45 LQ45 + WIKA |
| `server/routes.ts:1651` | `SIMULATION_STOCK_UNIVERSE` array (inline constant) | 12 symbols (blue chips + speculative) |

**Issue:** `HOMEPAGE_UNIVERSE` (46 symbols) adds **WIKA** on top of the 45-stock `LQ45_UNIVERSE`. WIKA was dropped from LQ45 in the Feb 2024 rebalancing (financial distress; pe_ratio=0, roe=-18.4%) but remains in the homepage list. Because WIKA is not in `lq45Universe.ts`, the gorengan detector applies full L1–L4 analysis to it with no LQ45 exemption. Its market cap (5.4T IDR) sits at the exemption boundary, meaning it may or may not receive the market cap override depending on the parser. Recommend removing WIKA from `HOMEPAGE_UNIVERSE` or explicitly tracking it as a non-LQ45 watch stock.

---

### 3c — Gorengan Detection (2 implementations)

| Location | Function | Used By |
|---|---|---|
| `server/engine/gorenganDetector.ts:37` | `detectGorengan()` (internal) + `computeGorenganFromStock()` (exported) | radarEngine.ts, bandarmologyCoreV1.ts (re-exports wrapper) |
| `server/engine/bandarmologyCoreV1.ts:278` | `detectGorengan()` (internal, private) + `computeGorenganFromStock()` (v1 wrapper at line 364) | Only routes.ts via the v1 import chain |

**Verdict:** `gorenganDetector.ts` is the canonical version (imports `LQ45_UNIVERSE`, `parseBrokerIDR`, `parseForeignData`, `detectTapeControl`). `bandarmologyCoreV1.ts` contains a private copy of the detection logic AND a wrapper that simply delegates to the canonical version (lines 35, 364-377). The v1 internal `detectGorengan` at line 278 is dead code — it's never called in the v1 file because `computeGorenganFromStock` at line 364 delegates to `_computeGorenganFromStock` from `gorenganDetector.ts`.

---

### 3d — Composite Score Functions (2 implementations)

| Location | Function | Used By |
|---|---|---|
| `server/engine/bandarmologyCore.ts:1288` | `computeComposite()` | Internal to bandarmologyCore only (used by `computeBandarmologyV2`) |
| `server/engine/compositeEngineV3.ts:265` | `computeCompositeV3()` | routes.ts, runTests.ts |

**Verdict:** `computeComposite` in bandarmologyCore is an internal helper for the v2 engine. `computeCompositeV3` is the production 7-layer composite. No true duplication — they operate at different levels. However, the v2 result feeds into the v3 input (bandarmologyScore = v2 readiness), creating a two-stage chain.

---

### 3e — Broker Classification Helpers (2 implementations)

| Location | Function | Used By |
|---|---|---|
| `server/engine/brokerRegistry.ts:137` | `classifyBrokers<T>()` (generic, uses BROKER_REGISTRY) | bandarmologyExtensions.ts |
| `server/engine/bandarmologyCoreV1.ts:431` | `classifyBrokers()` (private, by broker code patterns only) | Internal to bandarmologyCoreV1 only |

**Verdict:** `brokerRegistry.ts` is the canonical implementation with a full registry of 70+ broker profiles. The v1 internal `classifyBrokers` is a simplified private version. No external overlap issue, but the v1 version is legacy.

---

## PART 4 — DEAD CODE / NEVER USED

### Files With No Downstream Imports

| File | Lines | Status |
|---|---|---|
| `server/engine/newsClassifier.ts` | 27 | **ORPHAN.** `classifyNewsBehavior` never imported anywhere in the codebase. |
| `server/engine/phaseDetection.ts` | 22 | **ORPHAN in v3 pipeline.** Only imported by `bandarmologyCoreV1.ts` (legacy). |
| `client/src/components/MiniSparkline.tsx` | ~30 | **ORPHAN.** Never imported in any page or component. |
| `client/src/components/SimulationToggle.tsx` | ~30 | **ORPHAN.** Never imported in App.tsx or any page. SimulationBanner.tsx serves a similar purpose and IS imported. |
| `client/src/components/v3/DecisionBadge.tsx` | 51 | **ORPHAN.** Exported from v3/index.ts but never imported in any page. |
| `client/src/components/v3/LayerBreakdown.tsx` | 165 | **ORPHAN.** Exported from v3/index.ts. StockDashboard imports `@/components/LayerBreakdown` (the non-v3 version at line 5), not the v3 version. |
| `client/src/components/v3/StockListRow.tsx` | 119 | **ORPHAN.** Exported from v3/index.ts but no page imports it. |
| `client/src/components/v3/CommodityCard.tsx` | 79 | **ORPHAN.** Exported from v3/index.ts. PasarPage renders commodity info inline, not via this component. |
| `client/src/lib/aiAnalysis.ts` | 55 | **ORPHAN.** Exports functions for AI stock analysis but is never imported in any component or page. |
| `server/engine/macroFlowFetcher.ts` | 191 | **Active via index.ts scheduled task** — not orphan. |
| `server/engine/altDataFetcher.ts` | 471 | **Active via routes.ts and index.ts** — not orphan. |

### Scripts Not Referenced in package.json

`server/scripts/seedLQ45.ts` IS referenced: `"seed:lq45": "tsx --env-file=.env server/scripts/seedLQ45.ts"`. No orphaned scripts found.

### `seed:demo` Script Reference

`package.json` references `"seed:demo": "tsx --env-file=.env scripts/seed-demo.ts"` but the file `scripts/seed-demo.ts` does NOT exist in the repository. This script will error if run.

---

## PART 5 — ROUTE INVENTORY

### Complete Route List (`server/routes.ts`)

| Method | Path | Description | Called From Frontend | Auth |
|---|---|---|---|---|
| USE | `/api` | Mounts testBandarmologyRouter | No | No |
| GET | `/api/stocks/:symbol` (via `api.stocks.getBySymbol.path`) | Returns single stock by symbol from DB | StockDashboard (via useStock hook) | No |
| GET | `/api/stocks` | Returns all stocks with readiness scores (full HOMEPAGE_UNIVERSE, fallback for missing DB rows) | Homepage, PasarPage, RadarPage, ScreenerPage | No |
| GET | `/api/search` | Searches stocks by symbol/name | No direct frontend call found | No |
| GET | `/api/watchlist` | Returns all watchlist items | RadarPage, WatchlistPage, ScreenerPage | No |
| POST | `/api/watchlist/:symbol` | Adds symbol to watchlist | RadarPage, WatchlistPage, ScreenerPage | No |
| DELETE | `/api/watchlist/:symbol` | Removes symbol from watchlist | RadarPage, WatchlistPage, ScreenerPage | No |
| POST | `/api/ai` | Claude AI analysis for a stock (rate-limited: 10/hr, 30/day per IP, 15min cache) | StockDashboard | No (rate-limited by IP) |
| POST | `/api/simulation/run` | Runs market replay simulation across stock universe | No direct frontend call found | No |
| GET | `/api/test-engine` | Runs engine validation test suite | No direct frontend call found | No |
| GET | `/api/diagnostics/market-data` | Tests Yahoo Finance connectivity for universe stocks | No direct frontend call found | No |
| GET | `/api/simulation/status` | Returns simulation feature description | No direct frontend call found | No |
| GET | `/api/simulation/audit/:runId` | Returns simulation audit logs for a run | No direct frontend call found | No |
| GET | `/api/radar` | Runs radar engine scan on all stocks (dynamic import) | No direct frontend call found | No |
| GET | `/api/radar/status` | Returns radar cache status | No direct frontend call found | No |
| GET | `/api/valuation/:symbol` | Computes valuation + synthesis + composite v3 for a symbol | StockDashboard | No |
| GET | `/api/alt-data/status` | Returns alt data fetcher cache status | No direct frontend call found | No |
| GET | `/api/alt-data/snapshot` | Returns CPO, coal, weather alt data snapshot | PasarPage | No |
| GET | `/api/history/:symbol` | Returns session history status for a symbol | No direct frontend call found | No |
| POST | `/api/ingest` | Ingests IDX session data (INGEST_SECRET Bearer auth) | No | Bearer INGEST_SECRET |
| GET | `/api/signals` | Returns signal lifecycle for watchlist items | WatchlistPage | No |
| POST | `/api/signals/:symbol/update` | Recalculates and updates signal lifecycle for a symbol | WatchlistPage | No |
| GET | `/api/monitor/scores` | Returns last score distribution | No direct frontend call found | No |
| POST | `/api/backtest` | Runs backtest for array of symbols | No direct frontend call found | No |
| GET | `/api/backtest/:symbol` | Runs backtest for single symbol | No direct frontend call found | No |
| GET | `/api/distribution/:symbol` | Computes distribution warning for a symbol | StockDashboard, RadarPage, WatchlistPage | No |
| GET | `/api/news/status` | Tests news fetcher health (triggers fetch) | No direct frontend call found | No |
| GET | `/api/sector-rotation` | Returns sector rotation snapshot | PasarPage | No |
| GET | `/api/macro/regime` | Returns current macro regime + 30-day history | Homepage | No |
| GET | `/api/macro/flow` | Returns 30-day macro flow history from DB | No direct frontend call found | No |
| GET | `/api/macro-context` | Returns macro context with commodity prices | PasarPage | No |
| POST | `/api/scraper/ingest` | Triggers on-demand broker data scrape | No direct frontend call found | No |
| GET | `/api/scraper/status` | Returns recent scrape_log entries | No direct frontend call found | No |
| GET | `/api/news` | Returns all screened + analyzed articles (feed) | BeritaPage, Homepage | No |
| GET | `/api/news/market/alerts` | Returns CRITICAL/HIGH severity alerts from last 24h | No direct frontend call found | No |
| GET | `/api/news/:symbol` | Returns news impacts + articles for a symbol | StockDashboard | No |
| POST | `/api/news/analyze/:articleId` | Triggers Claude analysis of a cached article | No direct frontend call found | Bearer MANAGEMENT_TOKEN |
| GET | `/api/insider/cluster-alerts` | Returns all symbols with active cluster buy signal | No direct frontend call found | No |
| GET | `/api/insider/:symbol` | Returns cached insider score and transactions | StockDashboard | No |
| POST | `/api/insider/:symbol/research` | Triggers Claude web-search for insider transactions | StockDashboard (research button) | Bearer MANAGEMENT_TOKEN |
| GET | `/api/management/:symbol` | Returns cached management score | StockDashboard | No |
| POST | `/api/management/:symbol/research` | Triggers Claude research for BOD members | StockDashboard (research button) | Bearer MANAGEMENT_TOKEN |
| POST | `/api/admin/seed-broker-data` | Manually seeds broker data for a stock | AdminSeed.tsx | Bearer MANAGEMENT_TOKEN |

### Orphaned Routes (Exposed But No Frontend Caller)

The following routes have no direct frontend caller and appear to be internal / admin / debugging endpoints:

- `/api/search` — Not called from any frontend page despite being useful
- `/api/simulation/run` — No UI trigger found
- `/api/test-engine` — Dev/debugging only
- `/api/diagnostics/market-data` — Dev only
- `/api/simulation/status` — Not displayed anywhere
- `/api/simulation/audit/:runId` — Admin/debugging
- `/api/radar` — RadarPage uses `/api/stocks` + distribution, not this endpoint directly
- `/api/radar/status` — Admin only
- `/api/history/:symbol` — Not called from frontend
- `/api/ingest` — External pipeline (not frontend)
- `/api/monitor/scores` — Not called from frontend
- `/api/backtest` (POST) — Not called from frontend
- `/api/backtest/:symbol` — Not called from frontend
- `/api/news/status` — Not called from frontend
- `/api/macro/flow` — Not called from frontend
- `/api/scraper/ingest` — Admin only (POST)
- `/api/scraper/status` — Not called from frontend
- `/api/news/market/alerts` — Not called from frontend
- `/api/news/analyze/:articleId` — Not called from frontend (could be triggered by background process)
- `/api/insider/cluster-alerts` — Not called from frontend
- `/api/alt-data/status` — Not called from frontend

**Routes called from multiple frontend pages (high traffic):**
- `/api/stocks` — 4 pages
- `/api/watchlist` — 3 pages
- `/api/distribution/:symbol` — 3 pages

---

## PART 6 — FRONTEND COMPONENT INVENTORY

### Pages

| Page File | Lines | API Routes Called | Key Components Used |
|---|---|---|---|
| `Homepage.tsx` | 750 | `/api/stocks`, `/api/news`, `/api/macro/regime` | Sidebar (via App.tsx), inline rendering |
| `StockDashboard.tsx` | 2,175 | `/api/ai`, `/api/distribution/:symbol`, `/api/valuation/:symbol`, `/api/news/:symbol`, `/api/management/:symbol`, `/api/insider/:symbol`, POST `/api/management/:symbol/research`, POST `/api/insider/:symbol/research` | StatusCard, LayerBreakdown, StockHeader, AIStockSummary, PriceChart, MetricCard, v3/ScoreRing, v3/BODMemberCard, v3/NewsArticleCard |
| `PasarPage.tsx` | 1,423 | `/api/stocks`, `/api/alt-data/snapshot`, `/api/sector-rotation`, `/api/macro-context` | Inline only |
| `WatchlistPage.tsx` | 1,019 | `/api/watchlist`, `/api/stocks`, `/api/signals`, `/api/distribution/:symbol`, DELETE/POST `/api/watchlist/:symbol`, POST `/api/signals/:symbol/update` | Inline only |
| `RadarPage.tsx` | 618 | `/api/stocks`, `/api/watchlist`, `/api/distribution/:symbol`, DELETE/POST `/api/watchlist/:symbol` | Inline only |
| `ScreenerPage.tsx` | 935 | `/api/stocks`, `/api/watchlist`, DELETE/POST `/api/watchlist/:symbol` | Inline only (MiniScoreRing defined locally at line 147) |
| `BeritaPage.tsx` | 648 | `/api/news` | v3/NewsArticleCard |
| `AdminSeed.tsx` | 340 | POST `/api/admin/seed-broker-data` | Inline form only |
| `not-found.tsx` | 21 | None | None |

### Components

| Component | Imported By | Notes |
|---|---|---|
| `Sidebar.tsx` (437 lines) | App.tsx | Active |
| `StatusCard.tsx` (153 lines) | StockDashboard.tsx | Active; internally uses `ScoreRing` and `DecisionBadge` |
| `LayerBreakdown.tsx` (172 lines) | StockDashboard.tsx | Active (non-v3 version) |
| `StockHeader.tsx` (100 lines) | StockDashboard.tsx | Active |
| `AIStockSummary.tsx` | StockDashboard.tsx | Active |
| `PriceChart.tsx` (602 lines) | StockDashboard.tsx | Active; uses lightweight-charts |
| `MetricCard.tsx` | StockDashboard.tsx | Active |
| `ScoreRing.tsx` (110 lines) | StatusCard.tsx | Active (used transitively via StatusCard) |
| `DecisionBadge.tsx` (51 lines) | StatusCard.tsx | Active (used transitively via StatusCard) |
| `SimulationBanner.tsx` (108 lines) | App.tsx | Active |
| `SimulationToggle.tsx` | **ORPHAN** | Never imported anywhere |
| `MiniSparkline.tsx` | **ORPHAN** | Never imported anywhere |
| `v3/ScoreRing.tsx` (76 lines) | StockDashboard.tsx | Active |
| `v3/BODMemberCard.tsx` (105 lines) | StockDashboard.tsx | Active |
| `v3/NewsArticleCard.tsx` (240 lines) | StockDashboard.tsx, BeritaPage.tsx | Active |
| `v3/DecisionBadge.tsx` (51 lines) | **ORPHAN** | In v3/index.ts but no page imports it |
| `v3/LayerBreakdown.tsx` (165 lines) | **ORPHAN** | In v3/index.ts; StockDashboard uses the non-v3 version |
| `v3/StockListRow.tsx` (119 lines) | **ORPHAN** | In v3/index.ts but never used |
| `v3/CommodityCard.tsx` (79 lines) | **ORPHAN** | In v3/index.ts; PasarPage renders commodity data inline |
| `v3/index.ts` | Never imported | Barrel export for orphaned components |
| `lib/aiAnalysis.ts` (55 lines) | **ORPHAN** | Never imported |
| `hooks/use-stocks.ts` (22 lines) | StockDashboard.tsx | Active |
| `hooks/use-mobile.tsx` (19 lines) | components/ui/sidebar.tsx | Active |
| `lib/queryClient.ts` (57 lines) | App.tsx, multiple pages | Active |
| `contexts/SimulationContext.tsx` (126 lines) | App.tsx, SimulationBanner.tsx, SimulationToggle.tsx | Active |

### Duplicate/Legacy Page Versions

No duplicate page versions found. All 8 page routes in App.tsx correspond to distinct pages with distinct URLs.

---

## PART 7 — DATABASE TABLE INVENTORY

### Tables Defined in Drizzle Schema (`/shared/schema.ts`)

| Table | Drizzle Name | Lines in Schema | Active? | Queried In |
|---|---|---|---|---|
| `stocks` | `stocks` | 15-97 | **YES** | storage.ts, routes.ts, engine files |
| `watchlist` | `watchlist` | 99-111 | **YES** | storage.ts, routes.ts |
| `historical_snapshots` | `historicalSnapshots` | 114-151 | **STALE** | storage.ts defines methods but rarely called in active routes. Used by simulation replay. |
| `simulation_audit_log` | `simulationAuditLog` | 154-182 | **SEMI-ACTIVE** | storage.ts, routes.ts (via `/api/simulation/audit/:runId`) |
| `session_history` | `sessionHistory` | 184-229 | **ACTIVE** | historyBuilder.ts, idxIngester.ts, backtestEngine.ts, radarEngine.ts, macroFlowFetcher.ts, insiderScorer.ts |
| `signal_lifecycle` | `signalLifecycle` | 231-257 | **ACTIVE** | signalLifecycle.ts, routes.ts |
| `news_impacts` | `newsImpacts` | 260-282 | **ACTIVE** | newsRouter.ts, outcomeTracker.ts |
| `management_profiles` | `managementProfiles` | 285-312 | **ACTIVE** | managementResearch.ts, managementScorer.ts, compositeEngineV3.ts (via managementScorer cache) |
| `rag_documents` | `ragDocuments` | 315-331 | **ACTIVE** | ragEngine.ts (create, retrieve), outcomeTracker.ts |

### Tables Used in Raw SQL But NOT in Drizzle Schema

These tables are created and queried via raw `pool.query()` calls but have no Drizzle schema definition:

| Table | Created/Used In | Purpose |
|---|---|---|
| `macro_regime_history` | `server/index.ts:154`, `routes.ts:2845` | Stores daily macro regime snapshots |
| `macro_flow_history` | `server/engine/macroFlowFetcher.ts:167`, `routes.ts:2861` | Stores daily macro flow data |
| `scrape_log` | `server/scrapers/brokerIngestor.ts:165`, `routes.ts:2926` | Logs broker scrape runs |

**Risk:** These 3 tables have no Drizzle migration coverage. They must be created manually via `db:push` or raw SQL. If `drizzle-kit push` is run without schema definitions, these tables will not be created.

### Migration Status

No `/migrations/` or `/drizzle/` directory exists. Schema is managed via `drizzle-kit push` (schema-push mode, not migration files). This means schema history is not version-controlled.

---

## PART 8 — DEPENDENCIES

### `package.json` Dependencies vs Actual Usage

| Package | Installed | Actually Imported | Notes |
|---|---|---|---|
| `@anthropic-ai/sdk` | Yes | Yes | routes.ts, insiderResearch.ts, newsAnalyzer.ts, managementResearch.ts, index.ts |
| `openai` | Yes | Yes | ragEngine.ts (for embeddings) |
| `express` | Yes | Yes | server/index.ts |
| `drizzle-orm` | Yes | Yes | db.ts, schema.ts, storage.ts |
| `drizzle-zod` | Yes | Yes | schema.ts |
| `@neondatabase/serverless` | Yes | Yes | db.ts, seedLQ45.ts |
| `pg` | Yes | Yes | db.ts (Pool import) |
| `playwright` | Yes | Yes | scrapers/idxBrokerScraper.ts, scrapers/stockbitBrokerScraper.ts |
| `ws` | Yes | Yes | db.ts, seedLQ45.ts (neonConfig websocket) |
| `zod` | Yes | Yes | schema.ts, routes |
| `@tanstack/react-query` | Yes | Yes | All frontend pages |
| `react`, `react-dom` | Yes | Yes | All frontend |
| `wouter` | Yes | Yes | App.tsx (routing) |
| `framer-motion` | Yes | Yes | StockDashboard.tsx |
| `lightweight-charts` | Yes | Yes | PriceChart.tsx |
| `recharts` | Yes | Yes | components/ui/chart.tsx |
| `react-icons` | Yes | **NOT FOUND** | No import in any .ts/.tsx file found. Likely unused. |
| `passport` | Yes | **NOT FOUND** | No import anywhere. Auth system not implemented. |
| `passport-local` | Yes | **NOT FOUND** | Same as above. |
| `express-session` | Yes | **NOT FOUND** | No import anywhere. Session management not implemented. |
| `connect-pg-simple` | Yes | **NOT FOUND** | Session store, unused. |
| `memorystore` | Yes | **NOT FOUND** | Session store, unused. |
| `@octokit/rest` | Yes | **NOT FOUND** | GitHub API client, no usage found anywhere in the codebase. |
| `@replit/connectors-sdk` | Yes | **NOT FOUND** | No import found in the codebase. |
| `next-themes` | Yes | **NOT FOUND** | No import found. |
| `date-fns` | Yes | Possibly (UI components) | Used in `ui/calendar.tsx` |
| `class-variance-authority` | Yes | Yes | UI components |
| `clsx` | Yes | Yes | ui/utils |
| `tailwind-merge` | Yes | Yes | ui/utils |
| `cmdk` | Yes | Yes | ui/command.tsx |
| `embla-carousel-react` | Yes | Yes | ui/carousel.tsx |
| `vaul` | Yes | Yes | ui/drawer.tsx |
| `input-otp` | Yes | Yes | ui/input-otp.tsx |
| `react-hook-form` | Yes | Yes | ui/form.tsx |
| `@hookform/resolvers` | Yes | Yes | ui/form.tsx |
| `framer-motion` | Yes | Yes | StockDashboard.tsx |
| `zod-validation-error` | Yes | Likely | zod errors |

**Unused/Zombie Dependencies (safe to remove):**
1. `passport` + `passport-local` — auth never implemented
2. `express-session` + `connect-pg-simple` + `memorystore` — session management never implemented
3. `@octokit/rest` — no GitHub API calls found
4. `@replit/connectors-sdk` — not imported anywhere
5. `next-themes` — not imported anywhere
6. `react-icons` — not imported anywhere (5.4.0 adds ~500KB to bundle)

---

## PART 9 — FUNDAMENTAL DATA QUALITY

### Schema Structure (stocks table)

The `stocks` table has 60+ columns covering:
- **Identifiers:** `symbol`, `name`, `sector`, `subsector`
- **Price data:** `price`, `change`, `changePercent`
- **Financials:** `peRatio`, `dividendYield`, `roe`, `netMargin`, `growth`, revenue/profit/assets/liabilities/OCF for 2023/2024/2025
- **Flow data:** `flowBias`, `flowIntensity`, `flowReliability`, `brokerData` (JSON), `foreignActivityData` (JSON)
- **Narrative fields:** `summary`, `description`, `investorView`, `financialSummary`, etc. (~20 text narrative fields)
- **Engine fields:** `avg20dValue`, `scrapeSource`, `updatedAt`

### Seed Data Assessment

All stock data in the database originates from ONE of two seed paths:

**Path 1 — BBCA and a few stocks seeded inline in `routes.ts` (lines 83-664):**
- BBCA, BMRI, and additional stocks hardcoded directly in `registerRoutes()`
- Data is entirely fabricated: prices are static integers, financial figures are approximate round numbers written by hand, broker data is 5 hardcoded broker entries with fabricated net buy/sell values
- `scrape_source` is NOT set (null) for these rows
- Insider transactions are fictional: "Jahja Setiaatmadja, 150,000 shares at 11,200 on 2025-12-18" — these did not come from any filing system

**Path 2 — Bulk seed via `server/scripts/seedLQ45.ts`:**
- 40+ stocks seeded with `scrape_source = 'SEED_INITIAL'`
- Financial figures are approximations (noted in comments: "approximate IDR, T = triliun") — not pulled from IDX filings
- Prices are hardcoded point-in-time values (e.g., BBRI at 4,180)
- Flow data (flowBias, flowIntensity, flowReliability) is hand-assigned
- Narrative text is **template-generated** at runtime by `buildParams()` using string interpolation (lines 810-845), not curated analysis
- `avg20dValue` is tagged as "TEMPORARY SEED — populated with tier-based estimates" in schema.ts line 85
- `buildBrokerData()` generates synthetic broker entries derived from `flowBias` type
- `buildForeignData()` generates synthetic foreign/domestic flow ratios

**`buildParams()` reveals template pattern (lines 810-847):**
```ts
`Investor memantau ${s.symbol} sebagai representasi kinerja sektor ${s.sector.toLowerCase()} Indonesia.` // investor_view
`Tidak ada berita material terbaru untuk ${s.symbol}.` // news_overview_summary
// Broker data is generated from flowBias, not from actual IDX data
```

### Data Confidence Assessment

| Data Field | Confidence | Source |
|---|---|---|
| Symbol, company name, sector | HIGH | Matches public IDX data |
| Price (current) | LOW | Hardcoded historical values, not live |
| PE ratio, dividend yield, ROE, net margin | MEDIUM | Approximate; directionally correct for major names |
| Revenue/profit/assets (2023-2025) | LOW-MEDIUM | Approximations in trillions; may have 5-15% error |
| Flow bias / flow intensity / reliability | LOW | Hand-assigned or template-generated, not from real broker data |
| Broker transaction data | SYNTHETIC | Entirely fabricated JSON |
| Foreign activity data | SYNTHETIC | Template-generated ratios |
| Insider transactions (insiderData field) | SYNTHETIC | Fictional names/amounts in BBCA seed |
| Narrative text fields | SYNTHETIC | Template-generated strings |
| avg20dValue | ESTIMATE | "tier-based estimates" per schema comment |
| News feed | SYNTHETIC | Placeholder "IDX News" headlines with static dates |

**Verdict: MOSTLY_SEED**

The database contains no live or scraped real-world data. All fields are either:
- Template-generated from compact seed parameters
- Hardcoded fabricated values
- Estimates based on public knowledge of major stocks

The scraper infrastructure (idxBrokerScraper, stockbitBrokerScraper) exists but is **disabled** (index.ts lines 209-214: "Demo mode. Scraper schedulers DISABLED"). The `brokerIngestor` is available via `POST /api/scraper/ingest` but requires working credentials and unblocked endpoints.

---

## PART 10 — HONEST VERDICT

### File Count Breakdown

| Recommendation | Server Files | Client Files | Total |
|---|---|---|---|
| **KEEP** (active, well-structured) | 38 | 75 | 113 |
| **REMOVE** (true orphans, zero imports, zero function) | 2 (`newsClassifier.ts`, `phaseDetection.ts`) | 6 (`MiniSparkline.tsx`, `SimulationToggle.tsx`, `v3/DecisionBadge.tsx`, `v3/LayerBreakdown.tsx`, `v3/StockListRow.tsx`, `v3/CommodityCard.tsx` + `lib/aiAnalysis.ts`) | 9 |
| **REFACTOR** (live but have structural issues) | 3 (`bandarmologyCoreV1.ts`, `parseBrokerIDR.ts`, `routes.ts`) | 0 | 3 |

**Server engine: 39 files.** 36 are active and well-used. 2 are true orphans. 1 is legacy-active with duplicate logic.

---

### Route Count Breakdown

| Status | Count |
|---|---|
| Called from frontend (active UI) | 16 |
| Backend/pipeline/admin (no UI caller but functional) | 24 |
| Orphaned (no caller, no scheduled use) | ~6 (`/api/search`, `/api/test-engine`, `/api/diagnostics/market-data`, `/api/simulation/status`, `/api/simulation/audit/:runId`, `/api/radar/status`) |

---

### DB Table Status

| Table | Status |
|---|---|
| `stocks` | ACTIVE — core data store |
| `watchlist` | ACTIVE — user watchlist |
| `session_history` | ACTIVE — ingest target, used by 6+ engine files |
| `signal_lifecycle` | ACTIVE — WatchlistPage reads/writes |
| `news_impacts` | ACTIVE — newsRouter + outcomeTracker |
| `management_profiles` | ACTIVE — managementScorer |
| `rag_documents` | ACTIVE — RAG retrieval |
| `macro_regime_history` | ACTIVE but UNSCHEMATIZED — raw SQL only, no Drizzle definition |
| `macro_flow_history` | ACTIVE but UNSCHEMATIZED — raw SQL only, no Drizzle definition |
| `scrape_log` | ACTIVE but UNSCHEMATIZED — raw SQL only, no Drizzle definition |
| `historical_snapshots` | STALE — defined in schema, storage methods exist, but rarely written to in production flow |
| `simulation_audit_log` | SEMI-ACTIVE — written by simulation run, read by audit endpoint |

---

### Fundamental Data Confidence

**MOSTLY_SEED**

All data in the `stocks` table is synthetic seed data. No live broker transaction data has been ingested. The scraper pipeline is disabled. Narrative fields are template-generated. Financial figures are hand-approximated.

---

### Recommended Cleanup Sequence (Safest First)

**Step 1 — Remove zombie npm dependencies (zero code risk)**
Remove from `package.json`: `passport`, `passport-local`, `express-session`, `connect-pg-simple`, `memorystore`, `@octokit/rest`, `@replit/connectors-sdk`, `next-themes`, `react-icons`. Run `npm install` afterward.

**Step 2 — Remove orphaned client files (zero server risk)**
Delete:
- `/client/src/components/MiniSparkline.tsx`
- `/client/src/components/SimulationToggle.tsx`
- `/client/src/lib/aiAnalysis.ts`
- `/client/src/components/v3/DecisionBadge.tsx`
- `/client/src/components/v3/LayerBreakdown.tsx`
- `/client/src/components/v3/StockListRow.tsx`
- `/client/src/components/v3/CommodityCard.tsx`
- Update `/client/src/components/v3/index.ts` to remove deleted exports.

**Step 3 — Remove orphaned server files (low risk)**
Delete:
- `/server/engine/newsClassifier.ts`
- `/server/engine/phaseDetection.ts` (only used by v1 which is targeted in Step 4)

**Step 4 — Consolidate IDR parsing**
In `parseBrokerIDR.ts` (9 lines), replace with a re-export from `bandarmologyCore.ts:parseIDR`. Update all callers. Delete `parseBrokerIDR.ts` and the duplicate in `brokerStability.ts`.

**Step 5 — Eliminate v1 import from routes.ts**
In `routes.ts` line 8, replace:
- `computeBandarmology` → not needed in production route (used only in simulation with v3 available)
- `buildBandarmologyInput` (v1) → already superseded by the v2 version in `buildBandarmologyInput.ts`
- `computeGorenganFromStock` (v1) → import directly from `gorenganDetector.ts`

After step 5, `bandarmologyCoreV1.ts` may only be needed by the simulation path (`/api/simulation/run`). Audit the simulation handler and replace v1 calls with v3 equivalents, then delete `bandarmologyCoreV1.ts`.

**Step 6 — Add Drizzle schemas for unschematized tables**
Add Drizzle table definitions for `macro_regime_history`, `macro_flow_history`, `scrape_log` to `shared/schema.ts`. Run `drizzle-kit push` to validate.

**Step 7 — Consolidate universe lists**
`HOMEPAGE_UNIVERSE` in `routes.ts` (46 stocks) contains all 45 LQ45 constituents plus WIKA, which left the LQ45 index in Feb 2024. Either remove WIKA from `HOMEPAGE_UNIVERSE`, or add a separate `WATCHLIST_EXTRAS` set for non-LQ45 names. Then move `HOMEPAGE_UNIVERSE` out of `routes.ts` and import it from `lq45Universe.ts` — making the universe definition a single source of truth.

**Step 8 — Break up routes.ts (3,445 lines)**
Split into domain-specific route files:
- `routes/stocks.ts` — stock CRUD + universe
- `routes/simulation.ts` — simulation + diagnostics
- `routes/news.ts` — news pipeline
- `routes/insider.ts` — insider + management
- `routes/market.ts` — sector rotation + macro + alt data
- `routes/admin.ts` — seed + scraper + ingest

---

*Audit complete. No files were modified during this analysis.*

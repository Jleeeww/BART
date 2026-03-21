# BART — Session Context Document

> Upload this file to Claude at the start of each session instead of sharing individual files.
> Sections 6, 7, and 8 are meant to be filled in by hand as you work.

---

## 1. Project Overview

BART is an AI-powered Indonesian stock market intelligence platform focused on bandarmology, broker flow analysis, institutional behavior detection, and Bahasa Indonesia–localized insights for retail investors. Target user: Indonesian retail investor trying to avoid pump-and-dump and time entries intelligently. Primary use case: helping users decide when to enter a position.

---

## 2. Locked Design Decisions

- UI sections: Ringkasan, Flow, Keuangan, Valuasi, Berita, Risiko, Insider
- Market Regime (Rezim Pasar) is the core engine
- Bandarmology-first performance focus
- Insider vs bandar alignment as a key signal
- Risk framed as failure conditions, not probability scores
- Bahasa Indonesia throughout
- No indicator overcrowding

Additional locked constraints (do not change without explicit discussion):
- Dark terminal theme is permanent — no light mode toggle; `index.css` has no `.dark` block
- `--primary` = sky blue `199 89% 60%` (`#38BDF8`)
- BART logo = plain text only, sky blue, no icon, no subtitle (applied in both Homepage and StockDashboard nav)
- Gorengan Detector is a hard safety override: always forces HINDARI_DULU and caps readiness ≤ 59
- v1.1 engine (`getStockDecision()`) must remain untouched — routes.ts uses it for all existing endpoints
- v2.0 engine entry point is `getStockDecisionV2()` in `unifiedDecision.ts`
- Locked calibration values: BBCA=77/WATCHLIST_PRIORITAS, UNVR=5/HINDARI_DULU — verified by test suite in `runTests.ts`
- No `Math.random()` anywhere in the engine layer — fully deterministic
- `netFlowHistory[0]` = OLDEST session, `netFlowHistory[N-1]` = TODAY — never reversed
- M16 reads stored prior-session M6 scores via `getM6History()` — never today's M6 (circular dependency)

---

## 3. Current UI Structure

### Homepage (`client/src/pages/Homepage.tsx`)
Route: `/`

- **Header**: BART wordmark (sky blue, text-only) on the left; `SimulationToggle` switch on the right
- **Page title block**: Left-border accent, title "Peta Kesiapan Saham Hari Ini", subtitle explaining bandarmology basis
- **3-tab layout** (driven by `homepageBucket` from `/api/stocks`):
  - `Siap Dipantau` — readiness ≥ 80, emerald accent, "struktur siap"
  - `Watchlist Prioritas` — readiness 60–79, amber accent, "sedang dipersiapkan"
  - `Hindari Dulu` — readiness < 60 or gorengan, red accent
- Each tab renders a list of **`StockCard`** components showing:
  - Symbol (link to `/stock/:symbol`), readiness score badge, watchlist badge, gorengan pulse badge
  - Company name, price, % change (colored with TrendingUp/TrendingDown icons)
  - Market regime badge, action guidance badge
  - AI sentence (one-line insight)
  - Star (watchlist toggle) and Detail button
- `StockCard` uses `border-l-2` left accent (emerald/amber/red), `bg-secondary/30 border border-border/40`
- Console audit runs on every render to verify all 12 stocks are bucketed (no silent drops)

### StockDashboard (`client/src/pages/StockDashboard.tsx`)
Route: `/stock/:symbol`

- **Sticky top nav**: BART text logo (links to `/`), IDX session status dot + label (WIB-aware), "IDX" monospace badge
- **`StockHeader`** component: Symbol (large), company name, IDX index badges (IDX30/LQ45/etc.), sector badge, stock tags, price, change %, lot value (price × 100 shares)
- **Layout**: 2-column grid — left is 2/3 width (chart + tabs), right is 1/3 (AI sidebar)
- **`PriceChart`** (left, top): lightweight-charts v5 interactive chart
- **7-tab analysis panel** (left, below chart):

  | Tab ID | Label | Icon | Content |
  |---|---|---|---|
  | overview | Ringkasan | PieChart | Action Guidance card, Decision Engine hero, ConvictionTimeline, AI summary, description |
  | financials | Keuangan | DollarSign | 3-year financials table (revenue, net profit, assets, liabilities, OCF), analyst view |
  | valuation | Valuasi | TrendingUp | PE ratio, dividend yield, ROE, net margin, YoY growth (MetricCard components) |
  | flow | Flow | Activity | Flow bias/intensity/reliability, broker table, foreign vs domestic split, trading summary |
  | news | Berita | Newspaper | News feed items, corporate actions, event analysis, investor interpretation |
  | risk | Risiko | AlertTriangle | Risk framework (failure conditions), risk analyst view |
  | insider | Insider | UserCheck | Insider transactions, direction signal (BUY/SELL/NEUTRAL) |

- **Ringkasan sub-sections** (most important):
  - **Action Guidance card** (`card-action-guidance`): colored border (green/amber/orange/red/slate), combined status badge, primary action label, confidence badge (Tinggi/Sedang/Rendah), short AI summary, collapsible "Lihat Alasan & Risiko" (whyAction list, mainRisk, failureTrigger, disclaimer)
  - **ConvictionTimeline**: 5-phase progress bar — Penempatan → Konfirmasi → Kepadatan → Distribusi → Reset — with explanation text
  - **`AIStockSummary`**: Indigo gradient card with Sparkles icon and confidence badge

- **AI data flow**: On stock load, `fetchAIAnalysis()` POSTs to `/api/ai` with stock context, price context, flow signals, and fundamentals; response populates `aiData` state used by Ringkasan

### PriceChart (`client/src/components/PriceChart.tsx`) — TradingView-style v2

Professional TradingView/Stockbit-style chart using lightweight-charts v5. Props: `data?: any[], symbol?: string` (both optional with fallback).

- **Left drawing toolbar** (42px wide, `bg-[#0d0d0d]`): 11 tools grouped by separators —
  - Navigation: Kursor (↖), Crosshair (⊕)
  - Lines: Garis Tren (╱), Garis Horizontal (─), Garis Vertikal (│), Ray (→)
  - Shapes: Fibonacci (ϕ), Rectangle (▭), Teks (T)
  - Utility: Ukur (↔), Hapus (⌫)
  - Active tool highlighted in sky blue `bg-[#38BDF8] text-black`
- **Top toolbar** (`bg-[#0d0d0d]`, border-b):
  - Left side: Symbol (white bold) · Timeframe · IDX · live OHLC readout (O white, H green `#26a69a`, L red `#ef5350`, C white, ±change colored)
  - Right side: 4 chart type buttons (candle 🕯 / bar ▮ / line ∿ / area ◿) in bordered group; "Indikator" dropdown button with active count badge
- **Indikator dropdown panel** (absolute, z-50, `w-64 bg-[#111]`):
  - **Overlay group**: MA 20 (`#f59e0b`), MA 50 (`#8b5cf6`), EMA 9 (`#34d399` dashed), EMA 21 (`#f97316` dashed), Bollinger Bands (`#6366f1` dotted upper/lower + solid mid), VWAP (`#ec4899` large-dashed)
  - **Oscillator group**: RSI 14 (`#a78bfa`), MACD 12/26/9 (`#38BDF8`), Stochastic 14 (`#fb923c`)
  - Each row: color dot + label + checkbox toggle (sky blue when active)
  - Footer: "Reset Semua" button to clear all indicators
- **Main chart** (420px): `createChart()` from lightweight-charts v5
  - Candlestick: green `#26a69a` up / red `#ef5350` down (body + border + wick)
  - Bar: same green/red coloring
  - Line: sky blue `#38BDF8`, 2px
  - Area: sky blue line + `#38BDF820` → `#38BDF805` gradient fill
  - Volume histogram always rendered (bottom 18%, alpha-colored `#26a69a33` / `#ef535033`)
  - Crosshair: dashed `#444` lines with `#333` label bg
  - Grid: `#161616` on `#0a0a0a` background
- **RSI sub-chart** (110px): violet line, dotted red 70 (OB) + green 30 (OS) reference lines, ✕ close button, label "RSI (14) — OB: 70 · OS: 30"
- **MACD sub-chart** (110px): sky blue MACD line + orange dashed signal line + colored histogram (green positive / red negative), label "MACD (12, 26, 9) — Biru: MACD · Oranye: Signal · Histogram"
- **Stochastic sub-chart** (110px): orange %K line, dotted red 80 (OB) + green 20 (OS) reference lines, label "Stochastic (14) — OB: 80 · OS: 20"
- **Bottom timeframe bar** (`bg-[#0d0d0d]`): 1D / 5D / 1M / 3M / 6M / 1Y / 5Y / All (sky blue active); right side shows active overlay indicator legend (colored line + label)
- **Fallback data**: When `data` prop is empty/absent, generates 120 weekdays of realistic OHLCV starting 2024-09-01; `symbol` defaults to "DEMO"
- **Technical helpers** (all inline in the file): `toOHLCV()`, `calcSMA()`, `calcEMA()`, `calcEMAGeneric()`, `calcBB()`, `calcRSI()`, `calcMACD()`, `calcStoch()`, `generateFallbackData()`
- **ResizeObserver** on every chart instance for responsive width; all sub-charts have `timeScale.visible: false` to save space

### Supporting Components

| Component | File | Role |
|---|---|---|
| `StockHeader` | `components/StockHeader.tsx` | Symbol/name/price block with IDX index and sector badges |
| `AIStockSummary` | `components/AIStockSummary.tsx` | Indigo gradient card for AI-generated text summary |
| `MetricCard` | `components/MetricCard.tsx` | Reusable single-metric display card |
| `SimulationToggle` | `components/SimulationToggle.tsx` | Switch to enable Market Replay Simulation mode |
| `SimulationBanner` | `components/SimulationBanner.tsx` | Banner displayed when simulation mode is active |

---

## 4. Current Codebase Structure

### Frontend (`client/src/`)

| File | Description |
|---|---|
| `App.tsx` | Wouter router: `/` → Homepage, `/stock/:symbol` → StockDashboard, `*` → 404 |
| `main.tsx` | React 18 entry point; wraps app in QueryClientProvider, TooltipProvider, SimulationProvider |
| `index.css` | CSS custom properties (dark terminal theme, sky blue primary), `body` bg `#0f0f0f`, `.hover-elevate` utility |
| `pages/Homepage.tsx` | Landing page: BART wordmark, 3-bucket tabs (Siap/Watchlist/Hindari), StockCard list, watchlist mutations |
| `pages/StockDashboard.tsx` | Individual stock page: sticky nav, StockHeader, PriceChart, 7-tab analysis panel, AI data fetch |
| `pages/not-found.tsx` | 404 fallback page |
| `components/PriceChart.tsx` | Interactive lightweight-charts v5 chart with Line/Candle toggle, MA/EMA/BB/RSI indicators, RSI sub-chart |
| `components/StockHeader.tsx` | Stock symbol + name header with price/change, IDX index badges, sector badge, lot value |
| `components/AIStockSummary.tsx` | Indigo gradient card rendering AI-generated stock summary with confidence badge |
| `components/MetricCard.tsx` | Generic card for a single labeled financial metric value |
| `components/SimulationToggle.tsx` | FlaskConical icon + Switch for toggling Market Replay Simulation mode |
| `components/SimulationBanner.tsx` | Top banner shown while simulation mode is active |
| `contexts/SimulationContext.tsx` | React context providing `isSimulationMode` state and `toggleSimulationMode` |
| `hooks/use-mobile.tsx` | Breakpoint hook returning `true` on mobile screens |
| `components/ui/` | shadcn/ui component library (accordion, badge, button, card, collapsible, dialog, skeleton, tabs, tooltip, etc.) |

### Backend (`server/`)

| File | Description |
|---|---|
| `index.ts` | Express app bootstrap: connects Neon DB, registers routes, starts server on port 5000 |
| `routes.ts` | All REST endpoints: `GET /api/stocks`, `GET /api/stock/:symbol`, `POST /api/ai`, `GET/POST/DELETE /api/watchlist`, simulation endpoints; seeds BBCA/UNVR on startup |
| `storage.ts` | Drizzle ORM storage layer: CRUD for stocks, watchlist, historicalSnapshots, simulationAuditLog; `IStorage` interface |
| `db.ts` | Neon serverless PostgreSQL connection via `@neondatabase/serverless`; exports `db` |
| `vite.ts` | Vite dev server integration (do not modify) |
| `static.ts` | Static file serving for production builds |

### Engine (`server/engine/`)

| File | Description |
|---|---|
| `bandarmologyCore.ts` | **v2.0 core engine** — 12-model, 5-phase pipeline; all mathematical primitives, model implementations (M1–M16), composite formula, calendar safety |
| `bandarmologyCoreV1.ts` | **v1.1 legacy engine** — kept untouched; used by `routes.ts` for existing endpoints; includes Gorengan Detector |
| `bandarmologyDecisionV2.ts` | Maps v2.0 composite score + M16 regime → decision label (WATCHLIST_PRIORITAS / SIAP_DIPANTAU / HINDARI_DULU / NETRAL) |
| `unifiedDecision.ts` | Single entry point: `getStockDecision()` (v1.1), `getStockDecisionV2()` (v2.0), `mapStockDataToInput()` (DB row → v1.1 input) |
| `bandarmologyHistory.ts` | Persistent M6 score history storage for M16 RegimeStability; in-memory Map fallback; `getM6History()` returns OLDEST→NEWEST |
| `buildBandarmologyInput.ts` | Transforms raw stock DB record into typed `BandarmologyInput` for v2.0 engine |
| `brokerStability.ts` | `calculateBrokerStabilityScore()` — broker concentration/consistency metric used by v1.1 |
| `flowQuality.ts` | `calculateFlowQualityScore()` — flow quality from foreign/domestic ratio, intensity, and reliability |
| `phaseDetection.ts` | `detectAccumulationPhase()` — simple rule-based phase label from flowBias/intensity/reliability |
| `insider.ts` | `getInsiderDirection()` — parses insider transaction JSON, returns BUY/SELL/NEUTRAL |
| `newsClassifier.ts` | Classifies news impact into Low / Medium / High |
| `tapeControl.ts` | Tape control pattern detection (price control by large players) |
| `parseBrokerIDR.ts` | Parses IDR value strings ("125.5B IDR", "1.2T IDR") to numeric amounts |
| `foreignParser.ts` | `parseForeignData()` — extracts netForeignFlow/netDomesticFlow from foreignActivityData JSON |
| `runTests.ts` | Engine test runner — verifies BBCA=77/WATCHLIST_PRIORITAS and UNVR=5/HINDARI_DULU locked values |
| `testScenarios.ts` | Test scenario definitions for engine validation |
| `routes/testBandarmology.ts` | Debug API routes for v2.0 engine inspection and test execution |

### Shared (`shared/`)

| File | Description |
|---|---|
| `schema.ts` | Drizzle ORM table definitions + Zod insert schemas for: `stocks`, `watchlist`, `historicalSnapshots`, `simulationAuditLog` |
| `shared/routes.ts` | API route type contracts and `StockResponse` interface |

### Config/Root

| File | Description |
|---|---|
| `vite.config.ts` | Vite config (do not modify) |
| `drizzle.config.ts` | Drizzle ORM config for migrations (do not modify) |
| `tsconfig.json` | TypeScript config with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`) |
| `replit.md` | Living project summary for agent memory (keep updated after architecture changes) |

---

## 5. Key Logic Summary

### A. v1.1 Unified Decision — `getStockDecision()` in `unifiedDecision.ts`

Simple additive readiness scoring:

```
readiness = 0
+ netFlow:        high=+25, medium=+12, low=+0
+ brokerStability: high=+20, medium=+10, low=+0
+ flowQuality:    high=+20, medium=+10, low=+0
+ priceTrend:     up=+20, sideways=+5, down=+0
+ volatility:     low=+10, medium=+5, high=+0
+ insider:        buy=+5, sell=−5, neutral=+0
```

Decision thresholds:
- `readiness ≥ 80` AND `priceTrend = up` → BUY (Siap Dipantau)
- `readiness ≥ 80` AND `priceTrend ≠ up` → WATCHLIST (Watchlist Prioritas) — "structural but no momentum"
- `readiness ≥ 60` → WATCHLIST (Watchlist Prioritas)
- `readiness < 60` → AVOID (Hindari Dulu)
- `isGorengan = true` → forces AVOID, caps readiness at 59, regardless of any score

### B. v2.0 Bandarmology Engine — `computeBandarmologyV2()` in `bandarmologyCore.ts`

**5-Phase Pipeline:**

**Phase 0 — Data Prep**
- `validateInputs()`: 6 corruption categories (E001–E005), 7 warning types (W001–W007)
- `getLiquidityTier()`: tier 1 (≥50B IDR), tier 2 (10–50B), tier 3 (2–10B), tier 4 (<2B → invalid)

**Phase 1 — Foundation Models** (read only raw inputs, no inter-model deps)
- **M1 AccumulationStrength** (weight 0.12): brokerConsistency×0.45 + flowDirection×0.35 + volConfirm×0.20
- **M2 AbsorptionScore** (weight 0.10): rangeCompression×0.40 + volSignal×0.30 + priceControl×0.30 — detects "high volume, narrow range"
- **M3 BrokerDominance** (weight 0.10): HHI-inspired concentration of top-3 accumulator brokers
- **M6 FlowNormalized** (weight 0.15): `safe_normalize(netTotalFlow / avg20dValue, −1.0, 1.0)` — symmetric so neutral flow = 50
- **M9 FakeBreakoutRisk** (weight 0.05, risk penalty only): detects retail pump patterns; applied as penalty = max(0, (M9−50)×0.15)

**Phase 2 — Pattern Models**
- **M7 BrokerRotation** (weight 0.08): top-3 buyer volume concentration as rotation proxy
- **M8 StealthAccumulation** (weight 0.10): `persistence × consistency` from netFlowHistory; reads M3.score
- **M11 FlowDecomposition** (weight 0.10): foreign score + domestic score + alignment score (foreign/domestic consistency)
- **M12 RollingAccumulation** (weight 0.12): recency-weighted sum of netFlowHistory with weights [1,2,3,4,5] (OLDEST→NEWEST)
- **M14 CampaignDuration** (weight 0.06): trailing streak of positive flow sessions; maturity: FORMING(<3d) / ACTIVE(3–7d) / MATURE(7–15d) / EXTENDED(>15d)

**Phase 3 — Regime Model**
- **M15 PriceElasticity** (weight 0.04): elasticity = |priceChange%| / |flowRatio|; inverted score = low elasticity → institutional (score→100); special case: positive flow + flat price → perfect absorption → score=90
- **M16 RegimeStability** (`computeM16()`): requires 5+ prior-session M6 scores (OLDEST→NEWEST, NEVER today's M6)
  - Computes: `flowMean`, `flowStd` (population std), `flowTrend` (least-squares linear slope)
  - Regime classification (deterministic thresholds):
    - `mean>60 AND std<15 AND trend≥0` → ACCUMULATION (+3)
    - `mean>60 AND std<15 AND trend<−2` → ACCUMULATION_FADING (−2)
    - `mean<40 AND std<15 AND trend≤0` → DISTRIBUTION (−3)
    - `mean<40 AND std<15 AND trend>2` → RECOVERY (0)
    - `std>25` → VOLATILE (−8)
    - `35≤mean≤65` → TRANSITION (−2)
    - else → NOISE (−5)

**Phase 4 — Calendar Safety (M13 filter)**

Sets `isReliable=false` without reading model scores:
- Ex-dividend: suppresses M6, M11, M12
- Rebalance day (LQ45/IDX30/MSCI): suppresses M7, M11
- Rights issue period: suppresses M6, M11, M12
- Post-suspension (first session after halt): suppresses M6, M12
- Year-end window dressing (late Dec): suppresses M14

**Phase 5 — Composite**

```
active = models where score ≠ null AND isReliable = true (M9 excluded)
rawScore = Σ(score × weight) / Σ(weight)  ← renormalized over ACTIVE weight only
riskPenalty = max(0, (M9.score − 50) × 0.15)  ← max 7.5 pts
finalScore = clamp(rawScore + regimeModifier − riskPenalty, 0, 100)
confidence = activeWeight / totalDeclaredWeight × 100%
```

Key fix vs v1.x: null models excluded from denominator (v1.x counted null as zero → systematic understatement of up to 20 pts).

### C. v2.0 Decision Mapping — `getBandarmologyDecisionV2()` in `bandarmologyDecisionV2.ts`

**Primary decision thresholds** (unchanged):
```
score ≥ 70 AND regime = ACCUMULATION  → WATCHLIST_PRIORITAS
score ≥ 55                            → SIAP_DIPANTAU
score < 40                            → HINDARI_DULU
else                                  → NETRAL
```

**Extended v2 output** (new fields):
- **CyclePosition** (from M14 maturity): TERLALU_DINI (FORMING) → KONFIRMASI_MULAI (ACTIVE) → ENTRY_WINDOW (MATURE) → WASPADAI_DISTRIBUSI (EXTENDED)
- **ConcentrationType** (from M3 + M6): KENDALI_BANDAR (M3≥40 AND M6≥35), JEBAKAN_DISTRIBUSI (M3≥40 AND M6<35), TERSEBAR (M3<40)
- **ConfirmationStatus**: 4 criteria — campaignActive (cycle≥KONFIRMASI), flowStrong (M6≥65), priceResponding (M15≥65), rollingStrong (M12≥65); met when ≥2 criteria pass
- **actionText**: Bahasa Indonesia contextual guidance string
- **urgency**: TINGGI (ENTRY_WINDOW+confirmed), SEDANG (KONFIRMASI+confirmed), RENDAH (else)
- Backward-compatible fields: `decision` (= label), `compositeScore`, `regime` — for `unifiedDecision.ts` consumption

### D. Stock Input Mapping — `mapStockDataToInput()` in `unifiedDecision.ts`

Maps DB stock row → `StockDecisionInput` for v1.1:
- `netFlow`: reads flowBias + flowIntensity
- `brokerStability`: calls `calculateBrokerStabilityScore(brokerArr)`
- `flowQuality`: calls `calculateFlowQualityScore()` with foreign/domestic flow
- `priceTrend`: from `changePercent` > 0.5 (up) / < −0.5 (down) / else sideways; growth > 10% can push sideways → up
- `volatility`: from flowBias+intensity and |changePercent| > 5
- `insider`: calls `getInsiderDirection(insiderData)`

### E. IDX Session Status — `getIDXSessionStatus()` in `StockDashboard.tsx`

WIB (UTC+7) time-based:
- 08:45–08:59 → "Pra-Pembukaan" (yellow)
- 09:00–12:00 → "Sesi 1 Berlangsung" (green, animated dot)
- 12:00–13:30 → "Istirahat" (yellow)
- 13:30–15:49 → "Sesi 2 Berlangsung" (green, animated dot)
- 15:50–16:00 → "Pra-Penutupan" (yellow)
- Weekend or outside hours → "Pasar Tutup" (red)

### F. Homepage Bucketing — `Homepage.tsx`

- Reads `homepageBucket` from `/api/stocks` response (server is single source of truth)
- Three buckets: `siap_dipantau`, `watchlist_prioritas`, `hindari_dulu`
- All 12 stocks must appear in exactly one bucket (console audit asserts this every render)

### G. Mathematical Primitives — `bandarmologyCore.ts`

All models are composed exclusively of four primitives:
- `clamp(value, lo, hi)`: clamps to [lo, hi]; NaN/Infinity → lo
- `safe_normalize(value, lo, hi)`: maps [lo, hi] → [0, 100]; nanDefault=50 (neutral)
- `safe_div(num, denom)`: division with full null/NaN/Inf/zero guards; nanDefault=null means "no signal"
- `clean_history(history, minLength)`: filters NaN/null/Inf, returns null if < minLength valid entries
- `linear_slope(values)`: least-squares linear slope; returns 0 on degenerate input

### H. Database Schema — `shared/schema.ts`

Four tables:
- **`stocks`**: Full stock profile — price, OHLCV, financials (3yr), flow data, broker JSON, foreign/domestic JSON, news JSON, risk JSON, insider JSON, AI fields
- **`watchlist`**: `symbol` + `addedAt` timestamp
- **`historicalSnapshots`**: Daily OHLCV + broker/flow data for simulation replay
- **`simulationAuditLog`**: Per-run simulation results with consistency/safety/UX sanity check results

---

## 6. Current Open Issues

[Add issues here]

---

## 7. Recent Changes

- **PriceChart v2 rewrite** (Session 3): Replaced entire `PriceChart.tsx` with TradingView/Stockbit-style chart. Added left drawing toolbar (11 tools), 4 chart types (candle/bar/line/area), top toolbar with live OHLC readout, "Indikator" dropdown panel with 6 overlay indicators (MA20/MA50/EMA9/EMA21/BB/VWAP) and 3 oscillator sub-charts (RSI/MACD/Stochastic each 110px), bottom timeframe bar (1D–All) with active indicator color legend. Props made optional with fallback data generator. Using lightweight-charts v5. Only `PriceChart.tsx` was changed — no other files touched.
- **Decision v2 extended output** (Session 3): Rewrote `bandarmologyDecisionV2.ts` with CyclePosition (M14 maturity mapping), ConcentrationType (M3+M6 concentration logic), ConfirmationStatus (4-criteria checklist), actionText, urgency. Added backward-compatible `decision`/`compositeScore`/`regime` fields so `unifiedDecision.ts` remains untouched. M14 in `bandarmologyCore.ts` already had `maturity` on return — no change needed.
- **StockDashboard v2 decision UI** (Session 3): Added derived `decisionV2` via `useMemo` in StockDashboard. Inserted "Posisi Siklus" cycle position display (color-coded: emerald/sky/amber/slate) and "Kriteria Konfirmasi" checklist card (4 criteria with ✓/○ indicators) in Ringkasan tab. Replaced Konsentrasi Kendali badge in Flow tab with v2 concentration type badge (Kendali Bandar / Jebakan Distribusi / Tersebar). Engine tests verified: BBCA=77/WATCHLIST_PRIORITAS ✓, UNVR=5/HINDARI_DULU ✓.
- **Homepage terminal redesign** (Session 4): Full visual overhaul of Homepage.tsx. Bloomberg/TradingView terminal aesthetic with IBM Plex Mono + Sora fonts. 5 sections: top nav (48px, #0a0a0a), hero block with scanline texture + IDX session status, aggregate stats bar (#111111, 4 stat blocks), Bandarmology Radar banner (#0d1a2a), and bucket tabs with redesigned stock cards. Cards now have row-click navigation, hover border (#38BDF8/30), staggered fadeInUp animation. Custom tab system replaces shadcn Tabs. All data logic, mutations, bucket filtering, and console audit preserved unchanged. No new packages — fonts via Google Fonts @import in index.css.

- **Homepage landing page rebuild** (Session 5): Complete rewrite of Homepage.tsx as a professional dark landing page. Full-viewport hero with blurred Radar table preview background (opacity 20%, blur 2px), gradient overlay, scanline texture. Staggered fadeInUp headline "Baca Pasar / Sebelum Harga / Bergerak." with CTA to /radar. Feature strip with 3 cards (Bandarmology Engine, Radar IDX, Bukan Sinyal Jual Beli). Bottom CTA strip. Removed all old bucket-tab logic, SimulationToggle, stats bar, stock card list. Data fetch from /api/stocks retained for background preview only.
- **Global stock search bar** (Session 5): Added search input to Sidebar.tsx between logo and nav items. Debounced (200ms) query fetches from GET /api/search?q={query} endpoint (added to routes.ts). Dropdown shows results with symbol, company name, price. Click navigates to /stock/:symbol. Empty/not-found states handled. Click-outside-to-close via mousedown listener.
- **Sidebar navigation + Radar page** (Session 5): Major structural change. Created `client/src/components/Sidebar.tsx` — fixed left 200px sidebar with 6 nav items (2 active: Peta Kesiapan + Radar, 4 locked with "Segera" badge), BART logo at top, company info at bottom. Modified `App.tsx` to wrap all routes in `AppLayout` (sidebar + main content with `ml-[200px]`). Added `/radar` route → `RadarPage.tsx`. Removed top nav bar from Homepage, moved SimulationToggle into hero section top-right. RadarPage: full radar table with filter pills (Semua/Akumulasi/Distribusi/Waspadai), regime badges, cycle position, flow bias, concentration type columns, DETAIL→ buttons. Client-side v2 derivation. Sidebar active state: exact match for `/`, plus `/stock/*` also highlights Beranda.
- **Watchlist feature** (Session 6): Added star/watchlist toggle to Radar rows (AKSI column, before DETAIL→ button). Created `WatchlistPage.tsx` at `/watchlist` with full table (same columns as Radar + DITAMBAHKAN date column), stats bar, optimistic remove with undo toast (3s auto-dismiss, "Batalkan" to re-add), empty state with CTA to /radar. Unlocked Watchlist nav item in Sidebar.tsx. Uses existing GET/POST/DELETE /api/watchlist endpoints. Optimistic state management via local `removedSymbols` Set (WatchlistPage) and `optimisticOverrides` record (RadarPage). Files modified: RadarPage.tsx, App.tsx, Sidebar.tsx. File created: WatchlistPage.tsx.
- **Radar batch engine (backend-only)** (Session 6): Created standalone `server/engine/radarEngine.ts` — processes stocks in 50-stock batches, 15min/60min cache TTL, 5000ms per-stock timeout, 60% confidence gate. Exports: `getRadarResults()`, `getRadarCacheStatus()`, `invalidateRadarCache()`. Added `GET /api/radar` and `GET /api/radar/status` endpoints to routes.ts (appended after all existing endpoints, no existing endpoints modified). Frontend RadarPage.tsx untouched — still uses `/api/stocks` for demo. The `/api/radar` endpoint is ready for when RadarPage is wired to it in a future session. Files created: `server/engine/radarEngine.ts`. Files modified (append-only): `server/routes.ts`.

- **StockDashboard nav + mobile responsive** (Session 6): Removed BART logo from StockDashboard.tsx sticky top nav (sidebar already provides navigation); kept IDX session status + badge right-aligned with `justify-end`. Added mobile top bar in App.tsx (`md:hidden`, fixed, h-12, BART logo left + hamburger icon right, no drawer yet). Main content area changed to `ml-0 md:ml-[200px] pt-12 md:pt-0` for mobile full-width + top bar clearance. Sidebar already had `hidden md:flex` from prior session. Files modified: StockDashboard.tsx, App.tsx.
- **Screener page** (Session 7): Created `client/src/pages/ScreenerPage.tsx` — user-controlled filter interface for IDX stocks. Two-column layout (280px sticky filter panel + results table). 5 active filter groups: Rezim Pasar (multi-select), Posisi Siklus (multi-select), Skor Minimum (range slider), Sektor (dynamic from data), Aliran Dana (multi-select). 3 disabled "Live IDX" filter groups: Likuiditas, Volume Anomali, Kapitalisasi Pasar (visible but grayed with badge). Sort bar with 4 options (Skor ↓/↑, Nama A–Z, Perubahan ↓). Same table structure as Radar with star toggle and DETAIL→ button. Uses /api/stocks + /api/watchlist only. Added `/screener` route in App.tsx. Unlocked Screener nav in Sidebar.tsx (removed `locked: true`). Files created: ScreenerPage.tsx. Files modified: App.tsx, Sidebar.tsx.
- **Sidebar BART logo size** (Session 7): Changed BART logo text in Sidebar.tsx from `text-base` (16px) to `text-xl` (20px). Files modified: Sidebar.tsx.
- **StockHeader logo + Valuasi tab** (Session 7): Replaced single-letter avatar in `client/src/components/StockHeader.tsx` with Stockbit CDN logo (`https://assets.stockbit.com/logos/companies/{SYMBOL}.png`) + 2-letter fallback on error — same pattern as Radar/Screener. Replaced "Segera Hadir" placeholder in Valuasi tab (StockDashboard.tsx) with 2×2 metric grid: P/E Ratio (amber >25, green <15), Dividend Yield (green >3%), ROE (green >15%, red <5%), Net Margin (green >20%). Missing/zero values show "—". Added "CATATAN ANALIS" note below grid. Uses existing `peRatio`, `dividendYield`, `roe`, `netMargin` fields from stock response. Files modified: StockHeader.tsx, StockDashboard.tsx.

- **Pasar page** (Session 9): Created `client/src/pages/PasarPage.tsx` — market overview page at `/pasar`. Sections: (A) header with IDX session status, (B) market pulse bar with 4 stat blocks (IHSG/Volume/Net Foreign as Live IDX placeholders, Status shows real session state), (C) 2-column grid with 5 cards (IHSG chart placeholder, sector heatmap 11 sectors placeholder, Top Akumulasi from /api/stocks filtered by homepageBucket, Aktivitas Asing placeholder, Top Broker placeholder), (D) fully functional Alt Data panel (CPO price, HBA coal, BMKG weather) from /api/alt-data/snapshot with source badges (Live/Fallback), trend indicators, timestamps, weather icons per region. (E) Bottom notice. Unlocked Pasar in Sidebar.tsx (removed `locked: true`). Added `/pasar` route in App.tsx. Files created: PasarPage.tsx. Files modified: App.tsx, Sidebar.tsx.
- **Collapsible sidebar** (Session 9): Sidebar.tsx now accepts `collapsed` and `onToggle` props. Expanded: 200px with labels, search, footer. Collapsed: 56px icons-only with tooltips, logo shows "B". Toggle button at bottom (ChevronsLeft/ChevronsRight) with aria-label. App.tsx manages state in AppLayout, uses `useMediaQuery` (lazy-init to avoid flicker) to compute main content marginLeft dynamically (0 on mobile, 56 or 200 on desktop). Smooth `transition-all duration-200`. Files modified: Sidebar.tsx, App.tsx, replit.md.
- **Radar PERGERAKAN column** (Session 9): Added PERGERAKAN column to RadarPage.tsx table between SEKTOR and SKOR. Shows price ("Rp {formatted}") and change percent ("▲ +X.XX%" green / "▼ -X.XX%" red / "— 0.00%" gray). Uses `String(stock.price)` to handle both string and numeric values. Updated loading skeleton and empty state colspan from 8 to 9. Column order: SAHAM, SEKTOR, PERGERAKAN, SKOR, REZIM, POSISI SIKLUS, ALIRAN DANA, KONSENTRASI, AKSI. Files modified: RadarPage.tsx.
- **Alternative Data Fetcher** (Session 9): Created `server/engine/altDataFetcher.ts` — standalone module fetching/caching Indonesian public alternative data from 3 sources: BMKG weather (10 key production regions, 3h TTL), CPO reference price (ESDM, 6h TTL), HBA coal index (ESDM, 24h TTL). Never throws; returns stale cache or hardcoded fallback on failure. Max 3 consecutive failures before source marked degraded. Shadow mode — data cached but not yet consumed by engine (M17/M18/M19 models). Added debug endpoints: `GET /api/alt-data/status` and `GET /api/alt-data/snapshot` (appended to routes.ts via dynamic import). Added warmup call in server/index.ts listen callback. Files created: altDataFetcher.ts. Files modified: routes.ts, index.ts.
- **Valuation Modifier** (Session 8): Created `server/engine/valuationModifier.ts` — applies ±5 max adjustment to bandarmology readiness score based on valuation (MURAH=+3, WAJAR=0, MAHAL=-3) and quality (KUAT=+2, SEDANG=0, LEMAH=-2). Boundary protection prevents bucket crossings (HINDARI→WATCHLIST, WATCHLIST→SIAP). Wired into both `/api/ai` (stock detail) and `/api/stocks` (bulk) endpoints via top-level imports. New calibration: BBCA=74/WATCHLIST_PRIORITAS (was 77, modifier -3 from MAHAL), UNVR=10/HINDARI_DULU (was 5, modifier +5 from MURAH+KUAT). UI shows modifier below readiness score as "▲/▼ N poin dari valuasi". Files created: valuationModifier.ts. Files modified: routes.ts, StockDashboard.tsx.
- **Valuation + Synthesis Engine** (Session 8): Created `server/engine/valuationEngine.ts` — computes relative valuation (P/E vs sector benchmark) and fundamental quality (ROE, margin, dividend yield vs sector). 12 sector benchmarks for IDX (Financials, Consumer Staples, Energy, etc.) with `getSectorBenchmark()`. Returns MURAH/WAJAR/MAHAL for valuation, KUAT/SEDANG/LEMAH for quality, with confidence scores and Bahasa interpretations. Created `server/engine/synthesisEngine.ts` — cross-references valuation label with bandarmology flow state to produce 6 alignment types (MURAH_AKUMULASI, MURAH_DISTRIBUSI, WAJAR_AKUMULASI, WAJAR_DISTRIBUSI, MAHAL_AKUMULASI, MAHAL_DISTRIBUSI) plus INSUFFICIENT_DATA. Each alignment has headline, explanation, implication in Bahasa Indonesia, and alertLevel (POSITIVE/CAUTION/DANGER/INFO). Weighted synthScore (50% bandarmology, 30% quality, 20% inverted valuation) with alignment bonuses. Added `GET /api/valuation/:symbol` endpoint to routes.ts — uses `computeGorenganFromStock()` + `mapStockDataToInput()` + `getStockDecision()` for bandarmology context, returns valuation, synthesis, sectorBenchmark. Calibration verified: BBCA=MAHAL_AKUMULASI (P/E 2.3x sector, readiness 77), UNVR=MURAH_DISTRIBUSI (P/E 0.77x sector, readiness 5). Enhanced Valuasi tab in StockDashboard.tsx: verdict card (color-coded MURAH/WAJAR/MAHAL with sector badge), relative P/E bar chart, 2×2 metrics grid with sector avg benchmarks, quality card (KUAT/SEDANG/LEMAH), analyst note referencing sector. Added synthesis card to Ringkasan tab below action-guidance card: GitMerge icon, alertLevel-colored border/bg, headline + explanation + implication with ArrowRight. Files created: valuationEngine.ts, synthesisEngine.ts. Files modified: routes.ts, StockDashboard.tsx.

---

## 8. Session Notes

[Paste session-specific questions or context here]

# Stock Dashboard Application

## Overview

This is a stock analysis dashboard application built for the Indonesian market (IDX). It displays detailed stock information including price data, AI-generated summaries, financial metrics, trading flow analysis, and corporate actions. The application uses a React frontend with a Node.js/Express backend, connected to a PostgreSQL database via Drizzle ORM.

## AI Intelligence Features

The platform includes institutional-grade AI analysis capabilities:

### Flow Quality Score (0-100)
- Measures institutional conviction and flow synchronization
- Incorporates domestic/foreign participation, broker role mix, and execution patterns

### Broker Behavior Classification
- **Accumulator**: Net buying with position-building intent
- **Distributor**: Net selling with inventory reduction patterns
- **Market Maker**: Two-way flow providing liquidity
- **Operator**: Coordinated activity suggesting tape control
- **Retail Proxy**: Fragmented retail-driven activity

### Market Regime (A/D Mode Engine)
- **Stealth Accumulation**: Quiet position building under mechanical support
- **Active Accumulation**: Synchronized institutional buying
- **Distribution into Strength**: Selling masked by positive price action
- **Passive Distribution**: Gradual liquidation without price marking
- **Post-Distribution Vacuum**: Limited sponsorship searching for floor

### Smart Money Intent Engine
Analyzes combined signals to infer institutional objectives:
- **Inventory Building**: Quiet absorption, low volatility accumulation
- **Inventory Exit**: Selling into strength, distribution patterns
- **Price Support Operation**: Defensive buying, tape control
- **Mark-Up Preparation**: Transition to visible accumulation
- **Liquidity Harvesting**: Tactical positioning, churn patterns

### Conviction Timeline
Lifecycle phases: Positioning → Confirmation → Crowding → Distribution → Reset

### Broker Control Score (0-100%)
Measures concentration of net accumulation among top 3 brokers:
- **Low Concentration** (<40%): Broadly distributed accumulation, healthier trend structure
- **Moderate Concentration** (40-69%): Somewhat concentrated, depends on key broker behavior
- **High Concentration** (≥70%): Few brokers control most accumulation, higher manipulation risk

### Broker Stability Score (0-100%)
Measures whether the same brokers consistently dominate accumulation across multiple periods:
- **Low Stability** (<40%): Rotating leadership, short-term positioning
- **Moderate Stability** (40-69%): Emerging institutional interest, not full control
- **High Stability** (≥70%): Structured operator-style campaign with sustained intent

### Insider Activity Analysis
Tracks insider transactions with institutional-grade analysis:
- **Alignment Score** (0-100): Measures how well insider behavior aligns with positive outlook
- **Transaction History**: Detailed log of insider buys/sells with position, shares, price, and date
- **AI Interpretation**: Narrative analysis of what insider patterns indicate
- **Signal Strength**: Kuat (Strong), Moderat (Moderate), Lemah (Weak)
- **Sentiment Distribution**: Visual representation of buy vs sell activity over 12 months

### Additional Signals
- Early Distribution Detection
- Tape Control Detection
- Intent-influenced conviction explanations

All commentary maintains neutral, analytical tone without buy/sell recommendations or price targets.

### Unified Brain Engine (CRITICAL ARCHITECTURE)

The platform uses a single decision function `getStockDecision()` in `server/engine/unifiedDecision.ts` as the ONLY source of truth for all action guidance. All three endpoints (`/api/stocks`, `/api/ai`, `/api/simulation/run`) call this single function — no duplicated logic.

**3 Actions × 3 Buckets:**
1. **BUY** (Green) → **Siap Dipantau** — readiness ≥80 AND priceTrend up
2. **WATCHLIST** (Yellow) → **Watchlist Prioritas** — readiness 60-79, or ≥80 without momentum
3. **AVOID** (Red) → **Hindari Dulu** — readiness <60, or gorengan override

**Readiness Score Formula (0-100):**
- netFlow high: +25, medium: +12
- brokerStability high: +20, medium: +10
- flowQuality high: +20, medium: +10
- priceTrend up: +20, sideways: +5
- volatility low: +10, medium: +5
- insider buy: +5, sell: -5

**Safety Rules:**
- Gorengan stocks: readiness capped at 59, forced to AVOID
- BUY requires readiness ≥80 AND upward price trend
- High readiness without momentum → WATCHLIST (not BUY)

**Technical Implementation:**
- `server/engine/unifiedDecision.ts` — `getStockDecision()` and `mapStockDataToInput()`
- `server/engine/testScenarios.ts` — 4 locked test scenarios
- `server/engine/runTests.ts` — Test runner for `/api/test-engine`
- `server/engine/brokerStability.ts` — Deterministic broker stability score (concentration + volume commitment)
- `server/engine/flowQuality.ts` — Deterministic flow quality score (no base 50, uses sync/intensity/price/reliability/sell pressure)
- `server/engine/insider.ts` — Real insider direction from transaction data (BUY/SELL/NEUTRAL/NO_DATA)
- `server/engine/foreignParser.ts` — Foreign/domestic flow parser from JSON strings
- `server/engine/parseBrokerIDR.ts` — IDR value parser supporting T/B/M suffixes
- `server/engine/tapeControl.ts` — Tape control detection (tight range + volume + flow + price stability)
- `mapStockDataToInput()` translates DB stock fields into brain input format using all engine modules
- Homepage bucket always matches detail page action (enforced by same function)
- Engine is fully deterministic: same input → same output, zero randomness

### Gorengan Detector (Safety Engine)
Protects retail users from speculative pump-and-dump stocks using 4-layer detection:
1. **Price & Volume Anomaly**: >25% 5-day rise with volume >3× average
2. **Broker Flow Fragmentation**: Top 3 brokers < 35% net buy concentration
3. **Retail Dominance**: Small lot activity, no foreign flow
4. **Structural Failure**: No accumulation regime, no tape control

**Override Behavior:**
- isGorengan = true if ≥2 layers triggered
- Readiness score capped at max 59
- Action guidance forced to HINDARI_DULU
- Stock routed exclusively to "hindari_dulu" bucket

### Market Replay Simulator (Pre-Live Validation)
Simulation mode for validating AI analysis and UX consistency using REAL historical market data:

**Locked Stock Universe (12 stocks):**
- Blue Chips: ICBP, UNVR, BBCA, ADRO, UNTR (expected: Watchlist/Akumulasi, calm language)
- Speculative: BUMI, DADA, BULL, PIPA, WIFI, SGER, MORA (expected: Gorengan detector, Hindari Dulu)

**Activation:**
- Toggle "Mode Simulasi" in homepage header
- Banner shows: "Mode Simulasi Aktif – Data T-1" with "Real Market Data" badge

**Data Sources:**
- Real OHLC data fetched from Yahoo Finance API (.JK suffix for IDX stocks)
- 5-minute cache to avoid rate limiting
- Fallback to simulated data if API fails (with confidence: "Sedang")

**News Classification (Smart Filter):**
- FUNDAMENTAL: Earnings, dividends, capex, acquisitions, mergers
- SENTIMENT: Rumors, speculation, analyst recommendations
- IRRELEVANT: Market noise, technical analysis
- News NEVER directly changes Action Guidance (context only)

**Validation Pipeline:**
- Feature Extraction → Gorengan Detection → Market Regime → Readiness Score → Action Guidance → Bucket Assignment
- Consistency Check: Homepage bucket matches action guidance state
- Safety Check: Gorengan stocks clamped to max 59 readiness, Hindari Dulu
- UX Sanity Check: All labels in Bahasa Indonesia (no English)
- Behavior Check: Blue chips vs speculative expectations

**API Endpoints:**
- `POST /api/simulation/run`: Run full validation (returns audit summary with dataSourceStats)
- `GET /api/simulation/audit/:runId`: Retrieve persisted audit logs

**Audit Output:**
- Per-stock: readinessScore, marketRegime, actionGuidance, isGorengan, marketData (OHLC + dataSource), newsClassification
- Summary: passCount/failCount, dataSourceStats (realData/simulatedData/realDataPercent)
- Logs saved to `simulation_audit_log` table

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom configuration for development and production
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **UI Components**: shadcn/ui component library (Radix UI primitives with custom styling)
- **Charts**: Recharts for price visualization
- **Animations**: Framer Motion for transitions and micro-interactions
- **Fonts**: Inter (sans), Space Grotesk (display), Space Mono (monospace)

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx for development, esbuild for production
- **API Design**: RESTful endpoints under `/api/` prefix
- **Route Contracts**: Zod schemas in `shared/routes.ts` define API request/response types

### Data Storage
- **Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM with drizzle-kit for migrations
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Schema Validation**: drizzle-zod for automatic Zod schema generation from DB tables

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities and query client
│       └── pages/        # Page components
├── server/           # Express backend
│   ├── db.ts         # Database connection
│   ├── routes.ts     # API route handlers
│   ├── storage.ts    # Data access layer
│   └── index.ts      # Server entry point
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Database schema (Drizzle)
│   └── routes.ts     # API contracts (Zod)
└── migrations/       # Database migrations (auto-generated)
```

### Key Design Patterns
- **Shared Types**: Database schema and API contracts are defined in `shared/` directory, ensuring type safety across the full stack
- **Storage Abstraction**: `server/storage.ts` provides a data access interface, making it easy to swap implementations
- **Path Aliases**: TypeScript path aliases (`@/`, `@shared/`) for clean imports

### Development vs Production
- **Development**: Vite dev server with HMR, tsx for server compilation
- **Production**: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database accessed via `@neondatabase/serverless`
- **Connection**: Requires `DATABASE_URL` environment variable

### UI Libraries
- **Radix UI**: Headless component primitives (dialogs, tabs, tooltips, etc.)
- **Recharts**: Stock price charting
- **Embla Carousel**: Carousel functionality
- **Vaul**: Drawer component
- **cmdk**: Command palette

### Development Tools
- **Replit Plugins**: `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` for enhanced Replit development experience

### Build Dependencies
- **esbuild**: Production server bundling with dependency optimization
- **Vite**: Frontend build tool with React plugin
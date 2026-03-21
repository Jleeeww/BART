# Stock Dashboard Application

## Overview
This project is a stock analysis dashboard for the Indonesian market (IDX). It provides detailed stock information, AI-generated insights (summaries, financial metrics, trading flow, corporate actions), and aims to be a comprehensive tool for market analysis. The application targets the Indonesian stock market, offering institutional-grade AI analysis to a broader user base.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### AI Intelligence Features
The platform incorporates several AI-driven analysis features, all stemming from a Unified Brain Engine. This engine utilizes a single decision function, `getStockDecision()`, as the sole source for all stock action guidance (BUY, WATCHLIST, AVOID). It calculates a "Readiness Score" based on various factors like net flow, broker stability, flow quality, price trend, volatility, and insider activity. A "Gorengan Detector" acts as a safety mechanism, identifying and flagging speculative stocks to protect users, forcing them into an "AVOID" category.

The core intelligence layer (`bandarmologyCore.ts`) uses a 12-model engine with a 5-phase pipeline for institutional-grade analysis. This includes models for accumulation strength, absorption, broker dominance, stealth accumulation, and regime stability.

A Market Replay Simulator is included for pre-live validation of AI analysis using historical market data, ensuring consistency and accuracy across different stock types (blue chips vs. speculative).

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS (dark terminal theme only, no light mode)
- **UI Components**: shadcn/ui (based on Radix UI)
- **Charts**: Recharts
- **Animations**: Framer Motion

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API Design**: RESTful endpoints
- **API Contracts**: Zod schemas for request/response validation

### Data Storage
- **Database**: PostgreSQL (via Neon serverless)
- **ORM**: Drizzle ORM with drizzle-kit for migrations

### Project Structure
- `client/`: React frontend
  - `client/src/components/Sidebar.tsx`: Fixed left sidebar navigation (200px, persistent)
  - `client/src/pages/Homepage.tsx`: Main dashboard ("Peta Kesiapan")
  - `client/src/pages/RadarPage.tsx`: Institutional radar table ("/radar")
  - `client/src/pages/WatchlistPage.tsx`: Watchlist page ("/watchlist")
  - `client/src/pages/StockDashboard.tsx`: Individual stock detail ("/stock/:symbol")
- `server/`: Node.js/Express backend
- `shared/`: Shared code (DB schema, API contracts)
- `migrations/`: Database migrations

### Navigation
- App uses a persistent left sidebar (Sidebar.tsx) with AppLayout wrapper in App.tsx
- Routes: `/` (Homepage), `/radar` (RadarPage), `/watchlist` (WatchlistPage), `/stock/:symbol` (StockDashboard)
- 3 locked nav items (Screener, Pasar, Pengaturan) show "Segera" badge

### Key Design Patterns
- **Shared Types**: Centralized definition of database schemas and API contracts for type safety.
- **Storage Abstraction**: Data access layer is abstracted.
- **Path Aliases**: For clean imports.

## External Dependencies

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database.

### UI Libraries
- **Radix UI**: Headless component primitives.
- **Recharts**: Charting library.
- **Embla Carousel**: Carousel functionality.
- **Vaul**: Drawer component.
- **cmdk**: Command palette.

### Build Dependencies
- **esbuild**: Production server bundling.
- **Vite**: Frontend build tool.
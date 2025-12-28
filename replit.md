# Stock Dashboard Application

## Overview

This is a stock analysis dashboard application built for the Indonesian market (IDX). It displays detailed stock information including price data, AI-generated summaries, financial metrics, trading flow analysis, and corporate actions. The application uses a React frontend with a Node.js/Express backend, connected to a PostgreSQL database via Drizzle ORM.

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
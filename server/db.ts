import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// node-postgres (TCP) driver — works with local Docker Postgres AND Neon cloud.
// Swapped from @neondatabase/serverless (WebSocket) so a plain local Postgres
// (docker-compose) can be used in development. For Neon, keep sslmode=require
// in DATABASE_URL.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

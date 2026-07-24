import type { Pool } from 'pg';

// Auth tables + seed admin account (username: admin / password: admin).
// Hash format is s2:<salthex>:<scrypt64hex> — verified by server/routes/auth.ts
// with scrypt N=16384, r=8, p=1, keylen=64. Change the admin password after
// first login before any public exposure.
const ADMIN_HASH =
  's2:a28def3d600002142d50a141f278c4e6:495fb747cab48c9bcfff476287accceb97e9a0ad7edd3655b05fbf660ac9c531eee0adcaf927cb198f7a48ef59696696c08832a246ac1449a30b3c892849225e';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         serial PRIMARY KEY,
      username   text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      role       text NOT NULL DEFAULT 'user',
      status     text NOT NULL DEFAULT 'PENDING',
      created_at timestamp DEFAULT now(),
      approved_at timestamp
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token      text PRIMARY KEY,
      user_id    integer NOT NULL,
      created_at timestamp DEFAULT now(),
      expires_at timestamp NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO users (username, password_hash, role, status, approved_at)
     VALUES ($1, $2, 'admin', 'APPROVED', now())
     ON CONFLICT (username) DO NOTHING`,
    ['admin', ADMIN_HASH],
  );
}

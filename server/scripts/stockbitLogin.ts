/**
 * One-time interactive Stockbit login. Opens a real browser window —
 * log in by hand (incl. OTP) — then saves the session so
 * server/engine/stockbitAuth.ts can refresh the access token headlessly
 * without needing your password or OTP again.
 *
 * Run: ./node_modules/.bin/tsx --env-file=.env server/scripts/stockbitLogin.ts
 */
import { loginInteractive } from '../engine/stockbitAuth';

loginInteractive()
  .then((token) => {
    console.log('\nLogin OK. Fresh token (first 40 chars):', token.slice(0, 40) + '...');
    console.log('Session saved — scheduled refresh will now keep this token current automatically.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[stockbitLogin] failed:', err);
    process.exit(1);
  });

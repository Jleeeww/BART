/**
 * ============================================================
 * STOCKBIT AUTH (Playwright session refresh) v1.0
 * ============================================================
 * server/engine/stockbitAuth.ts
 *
 * Stockbit's access token (STOCKBIT_TOKEN) expires ~24h and there
 * is no public refresh-token API we could find (tried exodus/api
 * subdomains — either 404, 405, or "update your app"). What DOES
 * work: the logged-in web session (cookies, ~1 month lifetime per
 * the `credentialStorage` cookie) silently re-mints a fresh access
 * token client-side on page load. So instead of reverse-engineering
 * that internal call, we drive a real (headless) browser with a
 * saved session and read the token straight out of Local Storage.
 *
 * Flow:
 *  1. One-time interactive login (`loginInteractive`) — opens a
 *     real window, you log in incl. 2FA/OTP by hand, we save the
 *     browser storage state (cookies) to STATE_PATH.
 *  2. Scheduled `refreshToken()` — headless run reusing STATE_PATH,
 *     no login prompt, reads `securitiesAccessToken` from Local Storage.
 *  3. If the saved session itself has expired, refreshToken()
 *     returns null and step 1 must be repeated manually.
 *
 * Chromium 1223's executablePath is pinned per a known cache
 * mismatch between installed Playwright and ~/.cache/ms-playwright.
 */

import fs from 'fs';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), 'server', '.stockbit-state.json');
const TOKEN_CACHE_PATH = path.join(process.cwd(), 'server', '.stockbit-token.json');
const CHROMIUM_PATH = '/home/nafhan/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome';

const PORTFOLIO_URL = 'https://stockbit.com/securities/portfolio';
const LOGIN_URL = 'https://stockbit.com/login';

interface TokenCache {
  token: string;
  savedAt: string;
}

function launchOpts(headless: boolean) {
  return {
    headless,
    executablePath: fs.existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined,
  };
}

/** Real installed Chrome (not Playwright's bundled/patched Chromium) — Google's
 *  OAuth login flow is much more likely to flag automated Chromium as unsafe. */
function realChromeLaunchOpts() {
  return {
    headless: false,
    channel: 'chrome' as const,
    args: ['--disable-blink-features=AutomationControlled'],
  };
}

/** Reads the last token this module wrote out, if any. */
export function readCachedToken(): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8')) as TokenCache;
    return raw.token || null;
  } catch {
    return null;
  }
}

function saveTokenCache(token: string): void {
  fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({ token, savedAt: new Date().toISOString() }, null, 2));
}

async function readLocalStorageToken(page: import('playwright').Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('securitiesAccessToken'));
}

/**
 * One-time interactive login. Opens a visible browser window; you log
 * in (incl. OTP) by hand. Waits up to 5 minutes, then saves session
 * cookies + the fresh access token.
 */
export async function loginInteractive(): Promise<string> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch(realChromeLaunchOpts());
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(LOGIN_URL);

  console.log('[stockbitAuth] Log in (with OTP if prompted) in the opened browser window...');

  const deadline = Date.now() + 5 * 60 * 1000;
  let token: string | null = null;
  while (Date.now() < deadline) {
    token = await readLocalStorageToken(page).catch(() => null);
    if (token) break;
    const keys = await page
      .evaluate(() => Object.keys(window.localStorage))
      .catch(() => ['<evaluate failed>']);
    console.log(`[stockbitAuth] waiting… url=${page.url()} localStorageKeys=${JSON.stringify(keys)}`);
    await page.waitForTimeout(5000);
  }

  if (!token) throw new Error('[stockbitAuth] timed out waiting for securitiesAccessToken in Local Storage');

  await context.storageState({ path: STATE_PATH });
  saveTokenCache(token);
  await browser.close();

  console.log(`[stockbitAuth] session saved to ${STATE_PATH}, token cached`);
  return token;
}

/**
 * Headless refresh using the saved session. Returns the fresh token,
 * or null if the saved session is gone/expired (needs loginInteractive again).
 */
export async function refreshToken(): Promise<string | null> {
  if (!fs.existsSync(STATE_PATH)) {
    console.warn('[stockbitAuth] no saved session — run loginInteractive() first');
    return null;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch(launchOpts(true));
  const context = await browser.newContext({ storageState: STATE_PATH });
  const page = await context.newPage();

  try {
    await page.goto(PORTFOLIO_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (page.url().includes('/login')) {
      console.warn('[stockbitAuth] saved session expired — needs interactive re-login');
      return null;
    }

    await page.waitForFunction(
      () => window.localStorage.getItem('securitiesAccessToken') != null,
      undefined,
      { timeout: 20000 },
    );
    const token = await readLocalStorageToken(page);
    if (!token) return null;

    // Cookies may have rotated — persist the refreshed state for next time.
    await context.storageState({ path: STATE_PATH });
    saveTokenCache(token);
    return token;
  } catch (err) {
    console.warn('[stockbitAuth] refresh failed:', err);
    return null;
  } finally {
    await browser.close();
  }
}

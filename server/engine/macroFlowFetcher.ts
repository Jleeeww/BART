export interface MacroFlowSnapshot {
  date: string;
  ihsgForeignNetFlow: number | null;
  indogbUstSpread:    number | null;
  indo5yCDS:          number | null;
  indo5yCDSSource:    'SCRAPE' | 'PROXY' | null;
  eidoVolume:         number | null;
  eidoChange:         number | null;
  usdIdr:             number | null;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'STALE';
}

async function fetchYahooSingleClose(
  ticker: string,
  rangeDays: number = 10
): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${rangeDays}d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as (number | null)[];
    if (!closes || closes.length === 0) return null;
    const valid = closes.filter((p): p is number => p !== null && isFinite(p));
    return valid.length > 0 ? valid[valid.length - 1] : null;
  } catch {
    return null;
  }
}

async function fetchYahooChangeAndVolume(
  ticker: string
): Promise<{ change: number | null; volume: number | null }> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=10d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
    const closes  = quote?.close  as (number | null)[] | undefined;
    const volumes = quote?.volume as (number | null)[] | undefined;
    if (!closes || closes.length < 2) return { change: null, volume: null };
    const validCloses = closes.filter((p): p is number => p !== null && isFinite(p));
    if (validCloses.length < 2) return { change: null, volume: null };
    const prev = validCloses[validCloses.length - 2];
    const last = validCloses[validCloses.length - 1];
    const change = prev > 0 ? Number(((last - prev) / prev * 100).toFixed(4)) : null;
    let volume: number | null = null;
    if (volumes && volumes.length > 0) {
      const lastVol = volumes[volumes.length - 1];
      volume = lastVol !== null && isFinite(lastVol) ? lastVol : null;
    }
    return { change, volume };
  } catch {
    return { change: null, volume: null };
  }
}

async function fetchIHSGForeignFlow(date: string): Promise<number | null> {
  try {
    const { pool } = await import('../db');
    const result = await pool.query<{ net: string }>(
      `SELECT COALESCE(SUM(net_foreign_flow), 0) / 1e9 AS net FROM session_history WHERE date = $1`,
      [date]
    );
    if (!result.rows || result.rows.length === 0) return null;
    const net = parseFloat(result.rows[0].net);
    return isFinite(net) ? net : null;
  } catch {
    return null;
  }
}

async function fetchIndoGB10Y(): Promise<number | null> {
  for (const ticker of ['IDINR10Y=RR', 'ID10Y=RR']) {
    const price = await fetchYahooSingleClose(ticker);
    if (price !== null) return price;
  }
  return null;
}

async function fetchUST10Y(): Promise<number | null> {
  return fetchYahooSingleClose('^TNX');
}

async function fetchUSDIDR(): Promise<number | null> {
  return fetchYahooSingleClose('USDIDR=X');
}

/**
 * Best-effort real Indonesia 5Y CDS (basis points).
 * No clean free API exists (Bloomberg/IHS/CMA are paid), so this scrapes a
 * public page and is expected to fail sometimes → returns null, and the caller
 * falls back to the spread-derived proxy. Any scraped value is sanity-clamped.
 */
async function fetchIndoCDS(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://www.worldgovernmentbonds.com/cds-historical-data/indonesia/5-years/',
      { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Look for the current CDS value (label "CDS value" or a bps figure near "5 Years").
    const m =
      html.match(/CDS\s*value[^0-9]{0,40}([0-9]{2,4}(?:\.[0-9]+)?)/i) ||
      html.match(/5\s*Years[\s\S]{0,120}?([0-9]{2,4}(?:\.[0-9]+)?)\s*(?:bps|<)/i);
    if (!m) return null;
    const bps = Number(m[1]);
    if (!isFinite(bps) || bps < 20 || bps > 2000) return null; // sanity clamp
    return Number(bps.toFixed(1));
  } catch {
    return null;
  }
}

/**
 * Proxy Indonesia 5Y CDS from the already-fetched IndoGB10Y−UST10Y spread.
 * Sovereign CDS and the local-currency risk spread move together; since the
 * regime detector only uses the 20-day *delta* of CDS, a monotonic proxy is
 * directionally sufficient to keep CAPITAL_FLIGHT detectable. Documented,
 * clamped, never null when a spread exists.
 */
function cdsProxyFromSpread(spreadBps: number | null): number | null {
  if (spreadBps === null || !isFinite(spreadBps)) return null;
  const proxy = 0.6 * spreadBps + 20;
  return Number(Math.max(20, Math.min(2000, proxy)).toFixed(1));
}

async function fetchEIDO(): Promise<{ change: number | null; volume: number | null }> {
  return fetchYahooChangeAndVolume('EIDO');
}

export async function getMacroFlowSnapshot(): Promise<MacroFlowSnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const [
    foreignFlowResult,
    indoGBResult,
    ust10yResult,
    cdsResult,
    eidoResult,
    usdIdrResult,
  ] = await Promise.allSettled([
    fetchIHSGForeignFlow(today),
    fetchIndoGB10Y(),
    fetchUST10Y(),
    fetchIndoCDS(),
    fetchEIDO(),
    fetchUSDIDR(),
  ]);

  const ihsgForeignNetFlow = foreignFlowResult.status === 'fulfilled' ? foreignFlowResult.value : null;
  const indoGB             = indoGBResult.status      === 'fulfilled' ? indoGBResult.value      : null;
  const ust10y             = ust10yResult.status       === 'fulfilled' ? ust10yResult.value       : null;
  const scrapedCDS         = cdsResult.status          === 'fulfilled' ? cdsResult.value          : null;
  const eido               = eidoResult.status         === 'fulfilled' ? eidoResult.value         : { change: null, volume: null };
  const usdIdr             = usdIdrResult.status       === 'fulfilled' ? usdIdrResult.value       : null;

  // Convert % yields to basis points: (IndoGB10Y - UST10Y) * 100
  const indogbUstSpread =
    indoGB !== null && ust10y !== null
      ? Number(((indoGB - ust10y) * 100).toFixed(2))
      : null;

  // CDS: prefer a real scraped value; otherwise derive the spread-based proxy.
  let indo5yCDS: number | null = scrapedCDS;
  let indo5yCDSSource: MacroFlowSnapshot['indo5yCDSSource'] = scrapedCDS !== null ? 'SCRAPE' : null;
  if (indo5yCDS === null) {
    const proxy = cdsProxyFromSpread(indogbUstSpread);
    if (proxy !== null) {
      indo5yCDS = proxy;
      indo5yCDSSource = 'PROXY';
    }
  }

  const eidoVolume = eido.volume;
  const eidoChange = eido.change;

  const keyFields = [ihsgForeignNetFlow, indogbUstSpread, usdIdr, eidoVolume];
  const nullCount = keyFields.filter(v => v === null).length;
  const dataQuality: MacroFlowSnapshot['dataQuality'] =
    nullCount === 0 ? 'COMPLETE' :
    nullCount <= 2  ? 'PARTIAL'  :
    'STALE';

  return {
    date: today,
    ihsgForeignNetFlow,
    indogbUstSpread,
    indo5yCDS,
    indo5yCDSSource,
    eidoVolume,
    eidoChange,
    usdIdr,
    dataQuality,
  };
}

export async function persistMacroFlowSnapshot(snapshot: MacroFlowSnapshot): Promise<void> {
  try {
    const { pool } = await import('../db');
    await pool.query(
      `INSERT INTO macro_flow_history
         (date, ihsg_foreign, indogb_ust, indo_cds, indo_cds_source, eido_volume, eido_change, data_quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (date) DO UPDATE SET
         ihsg_foreign    = EXCLUDED.ihsg_foreign,
         indogb_ust      = EXCLUDED.indogb_ust,
         indo_cds        = EXCLUDED.indo_cds,
         indo_cds_source = EXCLUDED.indo_cds_source,
         eido_volume     = EXCLUDED.eido_volume,
         eido_change     = EXCLUDED.eido_change,
         data_quality    = EXCLUDED.data_quality,
         fetched_at      = NOW()`,
      [
        snapshot.date,
        snapshot.ihsgForeignNetFlow,
        snapshot.indogbUstSpread,
        snapshot.indo5yCDS,
        snapshot.indo5yCDSSource,
        snapshot.eidoVolume,
        snapshot.eidoChange,
        snapshot.dataQuality,
      ]
    );
  } catch (err) {
    console.warn('[macroFlowFetcher] persistMacroFlowSnapshot failed:', err);
  }
}

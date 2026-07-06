import { useState } from "react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

const DEMO_SYMBOLS = ["BBCA", "BMRI", "ASII", "GOTO", "BREN"];
const ALL_SYMBOLS = [
  "AALI","ADRO","AKRA","AMRT","ANTM","ARTO","ASII","BBCA","BBNI","BBRI",
  "BBTN","BMRI","BREN","BRPT","BUKA","CPIN","CTRA","EMTK","ERAA","EXCL",
  "GGRM","GOTO","HRUM","ICBP","INCO","INDF","INKP","INTP","ISAT","ITMG",
  "JPFA","KLBF","LSIP","MAPI","MBMA","MDKA","MEDC","MIKA","MNCN","PGAS",
  "PGEO","PTBA","PTPP","SMGR","TBIG","TLKM","TOWR","UNTR","UNVR","WSKT",
];

interface SeedResult {
  symbol: string;
  date: string;
  composite: {
    before: number; after: number; delta: number;
    bucketBefore: string; bucketAfter: string;
  };
  extensionScores: {
    M17before: number | null; M17after: number | null;
    M18: null; M24: null;
  };
  activeFlags: string[];
  brokersSeeded: number;
  message: string;
}

const BUCKET_COLOR: Record<string, string> = {
  siap_dipantau:      "#22c55e",
  watchlist_prioritas:"#f59e0b",
  hindari_dulu:       "#ef4444",
};

const FLAG_COLOR: Record<string, string> = {
  SMART_MONEY_EXIT:              "#ef4444",
  DISTRIBUTION_CAPACITY_BUILT:   "#f97316",
  PUMP_WARNING:                  "#f59e0b",
  INSIDER_CLUSTER_BUY:           "#22c55e",
  INSIDER_CLUSTER_BUYING_WEAKNESS:"#16a34a",
  INSIDER_EXIT_DURING_ACCUMULATION:"#ef4444",
  MACRO_CAPITAL_FLIGHT:          "#dc2626",
};

export default function AdminSeed() {
  const [symbol, setSymbol]       = useState("BBCA");
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [brokersCSV, setBrokersCSV] = useState(
    `BK,PT Mandiri Sekuritas,125.5B IDR,null,12.4%,9540,9530
BNI,PT BNI Securities,98.2B IDR,null,9.8%,9545,9535
CIMB,PT CIMB Securities,72.3B IDR,null,7.2%,9542,9532
MBK,PT Maybank Kim Eng,null,45.3B IDR,8.7%,9548,9538
BHS,PT Bahana Securities,null,28.4B IDR,6.5%,9550,9540`
  );
  const [netFlow, setNetFlow]     = useState("");
  const [price, setPrice]         = useState("");
  const [token, setToken]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<SeedResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  function parseBrokersCSV(csv: string) {
    return csv.trim().split("\n").map(line => {
      const [code, name, netBuy, netSell, volumePercent, avgBuy, avgSell] = line.split(",").map(s => s.trim());
      return {
        code,
        name,
        netBuy:        netBuy  === "null" ? null : netBuy,
        netSell:       netSell === "null" ? null : netSell,
        volumePercent: volumePercent || undefined,
        avgBuy:        avgBuy  || undefined,
        avgSell:       avgSell || undefined,
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const brokers = parseBrokersCSV(brokersCSV);
      const body: Record<string, unknown> = { symbol, date, brokers };
      if (netFlow) body.netFlow = parseFloat(netFlow);
      if (price)   body.price   = parseFloat(price);

      const res = await fetch("/api/admin/seed-broker-data", {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setResult(data as SeedResult);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: mono, background: "#09090b", minHeight: "100vh", color: "#e4e4e7", padding: 32 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.05em", margin: 0 }}>
            ADMIN — DEMO DATA SEED
          </h1>
          <p style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
            Manually inject broker data for demo. Live scraping disabled (Cloudflare blocks IDX/Stockbit).
          </p>
        </div>

        <div style={{ background: "#0f0f11", border: "1px solid #27272a", borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "#a1a1aa", letterSpacing: "0.08em", marginBottom: 16, marginTop: 0 }}>
            QUICK SEED — DEMO PRESETS
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DEMO_SYMBOLS.map(sym => (
              <button
                key={sym}
                onClick={async () => {
                  setLoading(true); setError(null); setResult(null);
                  try {
                    const res = await fetch(`/server/seed-data/${sym}.json`).catch(() => null);
                    if (!res?.ok) {
                      const apiRes = await fetch("/api/admin/seed-broker-data", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                        body: JSON.stringify({ symbol: sym, date, brokers: parseBrokersCSV(brokersCSV) }),
                      });
                      const d = await apiRes.json();
                      apiRes.ok ? setResult(d) : setError(d.error || `HTTP ${apiRes.status}`);
                    }
                  } catch (err: unknown) {
                    setError(String(err));
                  } finally { setLoading(false); }
                }}
                style={{
                  padding: "6px 14px", fontSize: 11, fontFamily: mono,
                  background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4,
                  color: "#e4e4e7", cursor: "pointer",
                }}
              >
                {sym}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "#52525b", marginTop: 8, marginBottom: 0 }}>
            Quick buttons use the form fields below (token required). Use the manual form for custom data.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>SYMBOL</label>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 12 }}
              >
                <optgroup label="Demo Presets">
                  {DEMO_SYMBOLS.map(s => <option key={s}>{s}</option>)}
                </optgroup>
                <optgroup label="All LQ45">
                  {ALL_SYMBOLS.filter(s => !DEMO_SYMBOLS.includes(s)).map(s => <option key={s}>{s}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>DATE</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 12 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
              BROKER DATA (CSV: code, name, netBuy, netSell, volumePercent, avgBuy, avgSell — use "null" for empty)
            </label>
            <textarea
              value={brokersCSV}
              onChange={e => setBrokersCSV(e.target.value)}
              rows={6}
              style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 11, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>NET FLOW (IDR, optional)</label>
              <input
                type="number"
                value={netFlow}
                onChange={e => setNetFlow(e.target.value)}
                placeholder="e.g. 223200000000"
                style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 11, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>PRICE (IDR, optional)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 9540"
                style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 11, boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#a1a1aa", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>MANAGEMENT TOKEN</label>
              <input
                type="password"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="Bearer token"
                style={{ width: "100%", padding: "8px 10px", background: "#1c1c1f", border: "1px solid #3f3f46", borderRadius: 4, color: "#e4e4e7", fontFamily: mono, fontSize: 11, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            style={{
              padding: "10px 20px", fontSize: 12, fontFamily: mono, fontWeight: 700,
              background: loading ? "#1c1c1f" : "#f59e0b", color: loading ? "#71717a" : "#000",
              border: "none", borderRadius: 4, cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.05em",
            }}
          >
            {loading ? "SEEDING..." : "SEED BROKER DATA"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 24, padding: 16, background: "#1c0a0a", border: "1px solid #7f1d1d", borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>ERROR: {error}</p>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24, padding: 20, background: "#0a110a", border: "1px solid #166534", borderRadius: 6 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", letterSpacing: "0.08em", marginTop: 0, marginBottom: 16 }}>
              SEED COMPLETE — {result.symbol}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#0f0f11", borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 10, color: "#71717a", margin: "0 0 8px" }}>COMPOSITE SCORE</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#a1a1aa" }}>{result.composite.before}</span>
                  <span style={{ fontSize: 14, color: "#52525b" }}>→</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: result.composite.delta >= 0 ? "#22c55e" : "#ef4444" }}>
                    {result.composite.after}
                  </span>
                  <span style={{ fontSize: 12, color: result.composite.delta >= 0 ? "#22c55e" : "#ef4444" }}>
                    ({result.composite.delta >= 0 ? "+" : ""}{result.composite.delta})
                  </span>
                </div>
              </div>
              <div style={{ background: "#0f0f11", borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 10, color: "#71717a", margin: "0 0 8px" }}>BUCKET</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: BUCKET_COLOR[result.composite.bucketBefore] ?? "#a1a1aa" }}>
                    {result.composite.bucketBefore.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span style={{ fontSize: 14, color: "#52525b" }}>→</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: BUCKET_COLOR[result.composite.bucketAfter] ?? "#a1a1aa" }}>
                    {result.composite.bucketAfter.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {result.extensionScores.M17after !== null && (
              <div style={{ background: "#0f0f11", borderRadius: 6, padding: 12, marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: "#71717a", margin: "0 0 6px" }}>M17 SMART/DUMB DIVERGENCE</p>
                <span style={{ fontSize: 14, color: "#a1a1aa" }}>
                  {result.extensionScores.M17before ?? "—"} → <strong style={{ color: "#e4e4e7" }}>{result.extensionScores.M17after}</strong>
                </span>
              </div>
            )}

            {result.activeFlags.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 10, color: "#71717a", margin: "0 0 6px" }}>ACTIVE FLAGS</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {result.activeFlags.map(flag => (
                    <span
                      key={flag}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 3,
                        background: (FLAG_COLOR[flag] ?? "#52525b") + "22",
                        color: FLAG_COLOR[flag] ?? "#a1a1aa",
                        border: `1px solid ${FLAG_COLOR[flag] ?? "#52525b"}55`,
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <a
                href={`/stock/${result.symbol}`}
                style={{
                  fontSize: 11, padding: "6px 14px", background: "#1c1c1f", border: "1px solid #3f3f46",
                  borderRadius: 4, color: "#4fc3f7", textDecoration: "none", fontFamily: mono,
                }}
              >
                → View {result.symbol} Dashboard
              </a>
              <span style={{ fontSize: 11, color: "#52525b", padding: "6px 0" }}>
                {result.brokersSeeded} brokers seeded on {result.date}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

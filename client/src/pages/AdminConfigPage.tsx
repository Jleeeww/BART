import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { adminFetch, setAdminToken, clearAdminToken, getAdminToken } from "@/lib/adminAuth";
import { SlidersVertical, Play, Lock, LogOut } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

interface AdminConfig {
  config: {
    crisis_mode: { mode: string };
    suppression_override: { multiplier: number | null };
    scanner_enabled: { enabled: boolean };
    cost_caps: { thematic?: number; global?: number };
  };
  effectiveRegime: { regime: string; multiplier: number; note: string };
  cost: Record<string, number>;
  baseCaps: Record<string, number>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-2)", borderRadius: 10, padding: "16px 18px" }}>
      <h2 style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", color: "var(--text-2)", fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Login gate ────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    setAdminToken(pw.trim());
    // Validate by hitting a protected endpoint.
    const res = await adminFetch("GET", "/api/admin/config");
    setBusy(false);
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auth-status"] });
      onLogin();
    } else {
      clearAdminToken();
      setErr("Token salah.");
    }
  };

  return (
    <div style={{ padding: "80px 32px", maxWidth: 360, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Lock size={18} style={{ color: "var(--signal)" }} />
        <h1 style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Admin Login</h1>
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="password" autoFocus placeholder="Admin token"
          value={pw} onChange={(e) => setPw(e.target.value)}
          style={{ fontFamily: mono, fontSize: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-2)", background: "var(--surface-0)", color: "var(--text-1)" }}
        />
        {err && <span style={{ fontFamily: mono, fontSize: 12, color: "var(--danger)" }}>{err}</span>}
        <button
          type="submit" disabled={busy || !pw.trim()}
          style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--signal)", background: "var(--signal)", color: "var(--surface-0)", opacity: busy || !pw.trim() ? 0.6 : 1 }}
        >
          {busy ? "Memeriksa..." : "Masuk"}
        </button>
      </form>
      <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", lineHeight: 1.6, marginTop: 16 }}>
        Token = nilai <code>ADMIN_TOKEN</code> di file <code>.env</code> server.
      </p>
    </div>
  );
}

export default function AdminConfigPage() {
  const [, setTick] = useState(0); // force re-render after login

  // Is a token required, and are we currently authenticated?
  const { data: auth } = useQuery<{ authRequired: boolean; authenticated: boolean }>({
    queryKey: ["/api/admin/auth-status"],
    queryFn: async () => (await adminFetch("GET", "/api/admin/auth-status")).json(),
    retry: false,
  });

  const { data, isLoading, error } = useQuery<AdminConfig>({
    queryKey: ["/api/admin/config"],
    queryFn: async () => {
      const res = await adminFetch("GET", "/api/admin/config");
      if (res.status === 401) throw new Error("UNAUTHORIZED");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    retry: false,
    enabled: !!auth && (!auth.authRequired || auth.authenticated || !!getAdminToken()),
  });

  const [msg, setMsg] = useState("");

  const setConfig = useMutation({
    mutationFn: async (body: { key: string; value: unknown }) => {
      const res = await adminFetch("POST", "/api/admin/config", body);
      if (!res.ok) throw new Error(res.status === 401 ? "Token tidak valid" : await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/macro/regime"] });
      setMsg("Tersimpan.");
      setTimeout(() => setMsg(""), 2000);
    },
    onError: (e: any) => setMsg(`Error: ${e?.message ?? e}`),
  });

  const triggerScan = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("POST", "/api/admin/scan/trigger");
      if (!res.ok) throw new Error(res.status === 401 ? "Token tidak valid" : await res.text());
      return res.json();
    },
    onSuccess: (r: any) => {
      setMsg(`Scan: ${r.status} · ${r.eventCount ?? 0} tema · ${r.flags?.length ?? 0} saham`);
      queryClient.invalidateQueries({ queryKey: ["/api/thematic/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/config"] });
    },
    onError: (e: any) => setMsg(`Error: ${e?.message ?? e}`),
  });

  // Show login when a token is required and we're not authenticated (or got 401).
  const unauthorized = String((error as any)?.message ?? "").includes("UNAUTHORIZED");
  if (auth?.authRequired && (unauthorized || (!auth.authenticated && !getAdminToken()))) {
    return <AdminLogin onLogin={() => setTick((t) => t + 1)} />;
  }

  const logout = () => {
    clearAdminToken();
    queryClient.clear();
    setTick((t) => t + 1);
  };

  const cfg = data?.config;
  const crisisMode = cfg?.crisis_mode?.mode ?? "AUTO";
  const suppression = cfg?.suppression_override?.multiplier ?? null;
  const scannerOn = cfg?.scanner_enabled?.enabled !== false;

  return (
    <div style={{ padding: "48px 32px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <SlidersVertical size={20} style={{ color: "var(--signal)" }} />
        <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>Admin</h1>
        {auth?.authRequired && (
          <button
            onClick={logout}
            title="Keluar"
            style={{ marginLeft: "auto", fontFamily: mono, fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--border-2)", background: "transparent", color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <LogOut size={12} /> Keluar
          </button>
        )}
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", marginBottom: 24 }}>
        Kontrol runtime — berlaku tanpa redeploy (propagasi ~15 detik).
      </p>

      {msg && (
        <div style={{ fontFamily: mono, fontSize: 12, color: "var(--signal)", marginBottom: 16 }}>{msg}</div>
      )}

      {isLoading && <div style={{ height: 120, background: "var(--surface-1)", borderRadius: 10 }} className="animate-pulse" />}

      {!isLoading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Effective regime + spend */}
          <Panel title="STATUS EFEKTIF">
            <p style={{ fontFamily: mono, fontSize: 13, color: "var(--text-1)", margin: 0 }}>
              Rezim: <strong>{data.effectiveRegime.regime}</strong> · ×{data.effectiveRegime.multiplier}
            </p>
            <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{data.effectiveRegime.note}</p>
            <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>
              Biaya hari ini: total ${Number(data.cost.total ?? 0).toFixed(4)} / ${data.baseCaps.global} ·
              tema ${Number(data.cost.thematic ?? 0).toFixed(4)} / ${data.baseCaps.thematic}
            </p>
          </Panel>

          {/* Crisis mode */}
          <Panel title="MODE KRISIS">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["AUTO", "FORCE_CRISIS", "FORCE_NORMAL"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig.mutate({ key: "crisis_mode", value: { mode: m } })}
                  style={{
                    fontFamily: mono, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${crisisMode === m ? "var(--signal)" : "var(--border-2)"}`,
                    background: crisisMode === m ? "var(--signal)" : "transparent",
                    color: crisisMode === m ? "var(--surface-0)" : "var(--text-3)",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", marginTop: 8 }}>
              FORCE_CRISIS memaksa CAPITAL_FLIGHT (skor dipotong). FORCE_NORMAL menonaktifkan supresi. AUTO = deteksi otomatis.
            </p>
          </Panel>

          {/* Suppression override */}
          <Panel title="SUPRESI MINIMUM (AUTO)">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range" min={0.4} max={1.0} step={0.05}
                value={suppression ?? 1.0}
                onChange={(e) => setConfig.mutate({ key: "suppression_override", value: { multiplier: Number(e.target.value) } })}
                style={{ flex: 1 }}
              />
              <span style={{ fontFamily: mono, fontSize: 13, color: "var(--text-1)", minWidth: 40 }}>
                {suppression === null ? "auto" : `×${suppression.toFixed(2)}`}
              </span>
              <button
                onClick={() => setConfig.mutate({ key: "suppression_override", value: { multiplier: null } })}
                style={{ fontFamily: mono, fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border-2)", background: "transparent", color: "var(--text-3)", cursor: "pointer" }}
              >
                reset
              </button>
            </div>
            <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", marginTop: 8 }}>
              Hanya berlaku pada mode AUTO. Selalu diambil yang lebih konservatif (min dari auto &amp; override).
            </p>
          </Panel>

          {/* Scanner */}
          <Panel title="THEMATIC SCANNER">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setConfig.mutate({ key: "scanner_enabled", value: { enabled: !scannerOn } })}
                style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${scannerOn ? "var(--positive)" : "var(--border-2)"}`,
                  background: scannerOn ? "var(--positive)" : "transparent",
                  color: scannerOn ? "var(--surface-0)" : "var(--text-3)",
                }}
              >
                {scannerOn ? "AKTIF" : "NONAKTIF"}
              </button>
              <button
                onClick={() => { setMsg("Menjalankan scan..."); triggerScan.mutate(); }}
                disabled={triggerScan.isPending}
                style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--signal)", background: "transparent", color: "var(--signal)", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Play size={12} /> Jalankan scan sekarang
              </button>
            </div>
          </Panel>

          {/* Cost caps */}
          <Panel title="BATAS BIAYA (USD/hari)">
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {(["thematic", "global"] as const).map((k) => (
                <label key={k} style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 4 }}>
                  {k}
                  <input
                    type="number" step={0.5} min={0}
                    defaultValue={cfg?.cost_caps?.[k] ?? data.baseCaps[k]}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (isFinite(v) && v > 0) setConfig.mutate({ key: "cost_caps", value: { ...cfg?.cost_caps, [k]: v } });
                    }}
                    style={{ fontFamily: mono, fontSize: 13, padding: "6px 8px", width: 100, borderRadius: 6, border: "1px solid var(--border-2)", background: "var(--surface-0)", color: "var(--text-1)" }}
                  />
                </label>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

import { Lock, Clock, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

// Shown in place of every dashboard page while the account is still PENDING.
// AuthContext polls /api/auth/me every 15s, so approval unlocks without reload.
export function PendingLockScreen() {
  const { user, logout, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(false);

  async function checkNow() {
    setChecking(true);
    await refresh();
    setChecking(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "48px 16px", position: "relative", overflow: "hidden",
    }}>
      <div className="landing-grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center", position: "relative" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 12, margin: "0 auto 24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--signal-dim)", border: "1px solid var(--border-2)",
        }}>
          <Lock size={26} style={{ color: "var(--signal)" }} />
        </div>

        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Akun menunggu persetujuan
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-3)", marginBottom: 8 }}>
          Halo <strong style={{ color: "var(--text-1)" }}>{user?.username}</strong> —
          akunmu sudah terdaftar, tapi seluruh fitur terminal masih terkunci
          sampai admin menyetujui registrasimu.
        </p>
        <p style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontFamily: mono, fontSize: 12, color: "var(--warning)",
          border: "1px solid var(--warning)", borderRadius: 999,
          background: "color-mix(in srgb, var(--warning) 8%, transparent)",
          padding: "6px 14px", marginBottom: 32,
        }}>
          <Clock size={13} className="pulse-dot" /> STATUS: MENUNGGU TINJAUAN ADMIN
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={checkNow}
            disabled={checking}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
              padding: "10px 18px", borderRadius: 6, cursor: "pointer",
              background: "var(--signal)", color: "var(--surface-0)",
              border: "1px solid var(--signal)", opacity: checking ? 0.7 : 1,
            }}
            data-testid="pending-check-status"
          >
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
            CEK STATUS
          </button>
          <button
            onClick={async () => { await logout(); setLocation("/"); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: mono, fontSize: 12, letterSpacing: "0.04em",
              padding: "10px 18px", borderRadius: 6, cursor: "pointer",
              background: "transparent", color: "var(--text-2)",
              border: "1px solid var(--border-3)",
            }}
            data-testid="pending-logout"
          >
            <LogOut size={13} /> KELUAR
          </button>
        </div>

        <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", marginTop: 28 }}>
          Status dicek otomatis setiap 15 detik.
        </p>
      </div>
    </div>
  );
}

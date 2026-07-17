import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, User, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

const inputStyle: React.CSSProperties = {
  fontFamily: mono, fontSize: 14,
  width: "100%", borderRadius: 6,
  padding: "11px 12px 11px 38px",
  background: "var(--surface-1)",
  border: "1px solid var(--border-2)",
  color: "var(--text-1)",
  outline: "none",
};

function Field({
  icon: Icon, ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ElementType }) {
  return (
    <div style={{ position: "relative" }}>
      <Icon size={15} style={{
        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
        color: "var(--text-4)", pointerEvents: "none",
      }} />
      <input
        {...props}
        style={inputStyle}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--signal)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
      />
    </div>
  );
}

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!isLogin && password !== confirm) {
      setError("Konfirmasi password tidak sama");
      return;
    }
    setBusy(true);
    try {
      if (isLogin) {
        await login(username.trim(), password);
      } else {
        // Register then log straight in — the account starts PENDING, so the
        // dashboard opens in locked mode until an admin approves it.
        await register(username.trim(), password);
        await login(username.trim(), password);
      }
      setLocation("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--surface-0)", color: "var(--text-1)",
      display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      <div className="landing-grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div style={{
        position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
        width: 640, height: 380, borderRadius: "50%",
        background: "var(--signal)", opacity: 0.06, filter: "blur(100px)", pointerEvents: "none",
      }} />

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px", position: "relative",
      }}>
        <Link href="/">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
            fontFamily: mono, fontSize: 12, color: "var(--text-3)", letterSpacing: "0.06em",
          }} data-testid="auth-back-home">
            <ArrowLeft size={14} /> KEMBALI
          </span>
        </Link>
        <button
          onClick={toggleTheme}
          aria-label="Ganti tema"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 34, height: 34, borderRadius: 6,
            border: "1px solid var(--border-2)", background: "transparent",
            color: "var(--text-3)", cursor: "pointer",
          }}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* Card */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px 64px", position: "relative",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 20, letterSpacing: "0.2em", color: "var(--signal)", marginBottom: 10 }}>
              BART<span className="cursor-blink" style={{ color: "var(--text-4)" }}>_</span>
            </div>
            <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 6 }}>
              {isLogin ? "Masuk ke terminal" : "Buat akun baru"}
            </h1>
            <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)", letterSpacing: "0.04em" }}>
              {isLogin ? "// autentikasi diperlukan" : "// registrasi → tinjauan admin → akses penuh"}
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              border: "1px solid var(--border-2)", borderRadius: 10,
              background: "var(--surface-1)", padding: 24,
              display: "grid", gap: 14,
            }}
          >
            <div>
              <label style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: "var(--text-3)", display: "block", marginBottom: 6 }}>
                USERNAME
              </label>
              <Field
                icon={User}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                autoFocus
                required
                data-testid="input-username"
              />
            </div>

            <div>
              <label style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: "var(--text-3)", display: "block", marginBottom: 6 }}>
                PASSWORD
              </label>
              <Field
                icon={KeyRound}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                data-testid="input-password"
              />
            </div>

            {!isLogin && (
              <div>
                <label style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.1em", color: "var(--text-3)", display: "block", marginBottom: 6 }}>
                  KONFIRMASI PASSWORD
                </label>
                <Field
                  icon={KeyRound}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  data-testid="input-confirm"
                />
              </div>
            )}

            {error && (
              <div style={{
                fontFamily: mono, fontSize: 12, color: "var(--danger)",
                border: "1px solid var(--danger)", borderRadius: 6,
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                padding: "9px 12px",
              }} data-testid="auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: "0.06em",
                padding: "12px 0", borderRadius: 6, cursor: busy ? "wait" : "pointer",
                background: "var(--signal)", color: "var(--surface-0)",
                border: "1px solid var(--signal)", opacity: busy ? 0.7 : 1,
                marginTop: 4,
              }}
              data-testid="auth-submit"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {isLogin ? "MASUK" : "DAFTAR"}
              {!busy && <ArrowRight size={15} />}
            </button>

            {!isLogin && (
              <p style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                fontFamily: mono, fontSize: 11, lineHeight: 1.6, color: "var(--text-4)",
              }}>
                <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 2, color: "var(--signal)" }} />
                Setelah daftar kamu langsung masuk, tapi fitur terkunci sampai
                akunmu disetujui admin.
              </p>
            )}
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontFamily: mono, fontSize: 12, color: "var(--text-3)" }}>
            {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
            <Link href={isLogin ? "/register" : "/login"}>
              <span style={{ color: "var(--signal)", cursor: "pointer", fontWeight: 600 }} data-testid="auth-switch-mode">
                {isLogin ? "Daftar" : "Masuk"}
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

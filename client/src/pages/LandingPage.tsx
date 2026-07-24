import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Radio,
  SlidersHorizontal,
  Newspaper,
  Sparkles,
  Waves,
  ShieldCheck,
  Sun,
  Moon,
  Lock,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

// Static demo tape — the landing page must render instantly, no API dependency.
const TAPE = [
  { s: "BBCA", p: "11.250", c: +0.45 },
  { s: "BBRI", p: "4.870", c: +1.24 },
  { s: "BMRI", p: "6.125", c: -0.65 },
  { s: "TLKM", p: "3.140", c: +0.96 },
  { s: "ASII", p: "5.075", c: -0.49 },
  { s: "GOTO", p: "68", c: +3.03 },
  { s: "ANTM", p: "1.865", c: +2.19 },
  { s: "ADRO", p: "2.540", c: -1.17 },
  { s: "UNTR", p: "27.300", c: +0.74 },
  { s: "MDKA", p: "2.310", c: +1.76 },
  { s: "BRPT", p: "1.055", c: -0.94 },
  { s: "AMMN", p: "8.925", c: +0.85 },
];

const SPARK =
  "M0,72 L28,68 L56,74 L84,60 L112,64 L140,52 L168,58 L196,44 L224,50 L252,38 L280,46 L308,30 L336,36 L364,24 L392,30 L420,16";

const FEATURES = [
  {
    n: "01",
    icon: Waves,
    title: "Bandarmology Flow",
    desc: "Lacak akumulasi dan distribusi broker besar — net flow asing vs domestik dibaca per sesi, bukan per rumor.",
  },
  {
    n: "02",
    icon: Radio,
    title: "Radar Sinyal",
    desc: "Skor komposit multi-lapisan menyaring saham yang siap dipantau dari yang sebaiknya dihindari dulu.",
  },
  {
    n: "03",
    icon: SlidersHorizontal,
    title: "Screener Disiplin",
    desc: "Saring universe LQ45 dengan guard likuiditas dan deteksi gorengan yang berjalan otomatis.",
  },
  {
    n: "04",
    icon: Newspaper,
    title: "Berita Terukur",
    desc: "Setiap artikel dipetakan ke emiten terdampak lengkap dengan arah, kekuatan, dan masa berlakunya.",
  },
  {
    n: "05",
    icon: Sparkles,
    title: "Tema Pasar AI",
    desc: "Scanner tematik dua kali sehari menandai sektor yang sedang dialiri katalis — murni overlay, skor tetap deterministik.",
  },
  {
    n: "06",
    icon: ShieldCheck,
    title: "Regime Guard",
    desc: "Deteksi regime makro (CDS, arus asing IHSG, EIDO) otomatis meredam sinyal saat pasar berisiko.",
  },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 6,
        border: "1px solid var(--border-2)", background: "transparent",
        color: "var(--text-3)", cursor: "pointer",
      }}
      data-testid="landing-theme-toggle"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "var(--surface-0)", color: "var(--text-1)", minHeight: "100vh" }}>
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          borderBottom: scrolled ? "1px solid var(--border-1)" : "1px solid transparent",
          background: scrolled ? "color-mix(in srgb, var(--surface-0) 85%, transparent)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          transition: "background 0.2s, border-color 0.2s",
        }}
      >
        <div style={{
          maxWidth: 1120, margin: "0 auto", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px",
        }}>
          <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, letterSpacing: "0.18em", color: "var(--signal)" }}>
            BART<span className="cursor-blink" style={{ color: "var(--text-4)" }}>_</span>
          </span>
          <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="#fitur" style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", textDecoration: "none", padding: "0 10px", letterSpacing: "0.04em" }} className="hidden sm:inline">
              FITUR
            </a>
            <a href="#akses" style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", textDecoration: "none", padding: "0 10px", letterSpacing: "0.04em" }} className="hidden sm:inline">
              AKSES
            </a>
            <ThemeToggle />
            {user ? (
              <button
                onClick={() => setLocation("/dashboard")}
                style={{
                  fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                  padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                  background: "var(--signal)", color: "var(--surface-0)", border: "1px solid var(--signal)",
                }}
                data-testid="nav-open-dashboard"
              >
                BUKA DASHBOARD
              </button>
            ) : (
              <>
                <Link href="/login">
                  <button style={{
                    fontFamily: mono, fontSize: 12, letterSpacing: "0.04em",
                    padding: "8px 14px", borderRadius: 6, cursor: "pointer",
                    background: "transparent", color: "var(--text-2)", border: "1px solid var(--border-3)",
                  }} data-testid="nav-login">
                    MASUK
                  </button>
                </Link>
                <Link href="/register">
                  <button style={{
                    fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em",
                    padding: "8px 16px", borderRadius: 6, cursor: "pointer",
                    background: "var(--signal)", color: "var(--surface-0)", border: "1px solid var(--signal)",
                  }} data-testid="nav-register">
                    DAFTAR
                  </button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ position: "relative", overflow: "hidden", paddingTop: 60 }}>
        <div className="landing-grid-bg" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div style={{
          position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)",
          width: 720, height: 420, borderRadius: "50%",
          background: "var(--signal)", opacity: 0.07, filter: "blur(110px)",
          pointerEvents: "none",
        }} />

        <div style={{
          maxWidth: 1120, margin: "0 auto", padding: "88px 24px 72px",
          display: "grid", gap: 56, position: "relative",
        }} className="lg:grid-cols-[1.05fr_0.95fr] grid-cols-1 items-center">
          {/* Left */}
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: mono, fontSize: 11, letterSpacing: "0.14em",
              color: "var(--signal)", border: "1px solid var(--border-2)",
              background: "var(--surface-1)", borderRadius: 999, padding: "5px 12px",
              marginBottom: 24,
            }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--signal)" }} />
              BANDARMOLOGY &amp; RESEARCH TERMINAL · IDX
            </div>

            <h1 style={{
              fontSize: "clamp(2.1rem, 4.6vw, 3.4rem)", lineHeight: 1.08,
              letterSpacing: "-0.03em", fontWeight: 700, marginBottom: 20,
            }}>
              Baca arah <span style={{ color: "var(--signal)" }}>bandar</span>,
              <br />
              sebelum pasar bergerak.
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-2)", maxWidth: 460, marginBottom: 32 }}>
              BART membaca aliran dana broker, regime makro, dan katalis berita di
              Bursa Efek Indonesia — lalu menyaringnya menjadi satu keputusan yang
              disiplin: pantau, prioritaskan, atau hindari.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
              <Link href={user ? "/dashboard" : "/register"}>
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
                  padding: "12px 22px", borderRadius: 6, cursor: "pointer",
                  background: "var(--signal)", color: "var(--surface-0)", border: "1px solid var(--signal)",
                }} data-testid="hero-cta-primary">
                  {user ? "BUKA DASHBOARD" : "MULAI GRATIS"}
                  <ArrowRight size={15} />
                </button>
              </Link>
              {!user && (
                <Link href="/login">
                  <button style={{
                    fontFamily: mono, fontSize: 13, letterSpacing: "0.04em",
                    padding: "12px 22px", borderRadius: 6, cursor: "pointer",
                    background: "transparent", color: "var(--text-1)", border: "1px solid var(--border-3)",
                  }} data-testid="hero-cta-login">
                    SUDAH PUNYA AKUN
                  </button>
                </Link>
              )}
            </div>

            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[
                ["46+", "emiten dipantau"],
                ["8", "lapisan analisis"],
                ["2×", "scan tematik / hari"],
              ].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>{v}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — terminal mock */}
          <div style={{
            border: "1px solid var(--border-2)", borderRadius: 10,
            background: "var(--surface-1)", overflow: "hidden",
            boxShadow: "0 0 60px -20px var(--signal-dim)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderBottom: "1px solid var(--border-1)",
            }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-3)", letterSpacing: "0.08em" }}>
                BBCA · BANK CENTRAL ASIA
              </span>
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--positive)" }}>+0.45%</span>
            </div>

            <div style={{ padding: "18px 14px 6px" }}>
              <svg viewBox="0 0 420 90" style={{ width: "100%", height: 96, display: "block" }}>
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${SPARK} L420,90 L0,90 Z`} fill="url(#sparkFill)" stroke="none" />
                <path d={SPARK} fill="none" stroke="var(--signal)" strokeWidth="2" className="spark-path" />
                <circle cx="420" cy="16" r="3.5" fill="var(--signal)" className="pulse-dot" />
              </svg>
            </div>

            <div style={{ padding: "10px 14px 16px", display: "grid", gap: 10 }}>
              {[
                { label: "AKUMULASI ASING", w: "78%", color: "var(--positive)", v: "+92.8B" },
                { label: "AKUMULASI DOMESTIK", w: "64%", color: "var(--positive)", v: "+130.4B" },
                { label: "DISTRIBUSI RETAIL", w: "31%", color: "var(--danger)", v: "-41.2B" },
              ].map((r, i) => (
                <div key={r.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: "var(--text-4)", letterSpacing: "0.1em" }}>{r.label}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: r.color }}>{r.v}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                    <div className="flow-bar" style={{
                      width: r.w, height: "100%", background: r.color, borderRadius: 2,
                      animationDelay: `${0.3 + i * 0.2}s`,
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderTop: "1px solid var(--border-1)",
              background: "var(--surface-2)",
            }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-3)", letterSpacing: "0.06em" }}>
                SKOR KOMPOSIT
              </span>
              <span style={{
                fontFamily: mono, fontSize: 12, fontWeight: 700, color: "var(--signal)",
                border: "1px solid var(--signal)", background: "var(--signal-dim)",
                borderRadius: 4, padding: "2px 10px",
              }}>
                SIAP DIPANTAU · 82
              </span>
            </div>
          </div>
        </div>

        {/* ── Ticker tape ────────────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid var(--border-1)", borderBottom: "1px solid var(--border-1)", overflow: "hidden", background: "var(--surface-1)" }}>
          <div className="ticker-track" style={{ display: "flex", width: "max-content", padding: "10px 0" }}>
            {[...TAPE, ...TAPE].map((t, i) => (
              <span key={i} style={{ display: "inline-flex", gap: 8, alignItems: "baseline", padding: "0 22px", borderRight: "1px solid var(--border-1)" }}>
                <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{t.s}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)" }}>{t.p}</span>
                <span style={{ fontFamily: mono, fontSize: 12, color: t.c >= 0 ? "var(--positive)" : "var(--danger)" }}>
                  {t.c >= 0 ? "▲" : "▼"} {Math.abs(t.c).toFixed(2)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="fitur" style={{ maxWidth: 1120, margin: "0 auto", padding: "88px 24px 40px" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.16em", color: "var(--signal)", marginBottom: 12 }}>
            // FITUR
          </div>
          <h2 style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)", letterSpacing: "-0.02em", maxWidth: 560 }}>
            Satu terminal, delapan lapisan analisis yang saling mengoreksi.
          </h2>
        </div>

        <div style={{ display: "grid", gap: 1, background: "var(--border-1)", border: "1px solid var(--border-1)" }}
          className="md:grid-cols-3 sm:grid-cols-2 grid-cols-1">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.n} className="landing-card" style={{ border: "none", borderRadius: 0, padding: "26px 22px", background: "var(--surface-0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <Icon size={18} style={{ color: "var(--signal)" }} />
                  <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>{f.n}</span>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-3)" }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Access flow ──────────────────────────────────────────────── */}
      <section id="akses" style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px 88px" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.16em", color: "var(--signal)", marginBottom: 12 }}>
            // AKSES
          </div>
          <h2 style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)", letterSpacing: "-0.02em", maxWidth: 560 }}>
            Akses dikurasi, bukan dijual massal.
          </h2>
        </div>

        <div style={{ display: "grid", gap: 20 }} className="md:grid-cols-3 grid-cols-1">
          {[
            {
              icon: UserPlus, step: "LANGKAH 01", title: "Daftar",
              desc: "Cukup username dan password. Tidak perlu email, tidak ada spam.",
            },
            {
              icon: Lock, step: "LANGKAH 02", title: "Tinjauan Admin",
              desc: "Kamu bisa langsung masuk, tapi fitur terkunci sampai admin menyetujui akunmu.",
            },
            {
              icon: KeyRound, step: "LANGKAH 03", title: "Akses Penuh",
              desc: "Setelah disetujui, seluruh terminal terbuka — radar, screener, flow, dan tema pasar.",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="landing-card" style={{ borderRadius: 8, padding: "26px 22px" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 6, marginBottom: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--signal-dim)", border: "1px solid var(--border-2)",
                }}>
                  <Icon size={17} style={{ color: "var(--signal)" }} />
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", color: "var(--text-4)", marginBottom: 6 }}>{s.step}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text-3)" }}>{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* CTA band */}
        <div style={{
          marginTop: 64, border: "1px solid var(--border-2)", borderRadius: 10,
          background: "linear-gradient(135deg, var(--signal-dim), transparent 60%)",
          padding: "40px 32px", display: "flex", flexWrap: "wrap", gap: 24,
          alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Siap membaca pasar dengan disiplin?</h3>
            <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", letterSpacing: "0.04em" }}>
              $ bart --register · gratis selama masa awal
            </p>
          </div>
          <Link href={user ? "/dashboard" : "/register"}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
              padding: "12px 24px", borderRadius: 6, cursor: "pointer",
              background: "var(--signal)", color: "var(--surface-0)", border: "1px solid var(--signal)",
            }} data-testid="cta-band-register">
              {user ? "BUKA DASHBOARD" : "DAFTAR SEKARANG"}
              <ArrowRight size={15} />
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border-1)" }}>
        <div style={{
          maxWidth: 1120, margin: "0 auto", padding: "22px 24px",
          display: "flex", flexWrap: "wrap", gap: 12,
          alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", letterSpacing: "0.08em" }}>
            BART v3.0 · BANDARMOLOGY &amp; RESEARCH TERMINAL
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>
            Bukan ajakan jual/beli. Data untuk riset pribadi.
          </span>
        </div>
      </footer>
    </div>
  );
}

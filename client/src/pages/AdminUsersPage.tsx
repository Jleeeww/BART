import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { authFetch, useAuth, type AuthUser } from "@/contexts/AuthContext";
import { Users, Check, X, ShieldCheck, Clock, Ban } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "MENUNGGU", color: "var(--warning)", icon: Clock },
  APPROVED: { label: "DISETUJUI", color: "var(--positive)", icon: ShieldCheck },
  REJECTED: { label: "DITOLAK", color: "var(--danger)", icon: Ban },
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();

  const { data, isLoading, error } = useQuery<{ users: AuthUser[] }>({
    queryKey: ["/api/auth/admin/users"],
    queryFn: async () => {
      const res = await authFetch("GET", "/api/auth/admin/users");
      if (!res.ok) throw new Error("Gagal memuat pengguna");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" }) => {
      const res = await authFetch("POST", `/api/auth/admin/users/${id}/${action}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Aksi gagal");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/admin/users"] }),
  });

  const users = data?.users ?? [];
  const pending = users.filter((u) => u.status === "PENDING");
  const others = users.filter((u) => u.status !== "PENDING");

  function UserRow({ u }: { u: AuthUser }) {
    const meta = STATUS_META[u.status] ?? STATUS_META.PENDING;
    const Icon = meta.icon;
    const isSelf = me?.id === u.id;
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          padding: "13px 16px", borderBottom: "1px solid var(--border-1)",
        }}
        data-testid={`user-row-${u.username}`}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--signal-dim)", fontFamily: mono, fontSize: 13,
          fontWeight: 700, color: "var(--signal)", textTransform: "uppercase",
        }}>
          {u.username[0]}
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
            {u.username}
            {u.role === "admin" && (
              <span style={{
                marginLeft: 8, fontSize: 10, color: "var(--signal)",
                border: "1px solid var(--signal)", background: "var(--signal-dim)",
                borderRadius: 3, padding: "1px 6px",
              }}>
                ADMIN
              </span>
            )}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>
            {u.createdAt ? new Date(u.createdAt).toLocaleString("id-ID") : "—"}
          </div>
        </div>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
          color: meta.color,
        }}>
          <Icon size={13} /> {meta.label}
        </span>
        {!isSelf && u.role !== "admin" && (
          <div style={{ display: "flex", gap: 8 }}>
            {u.status !== "APPROVED" && (
              <button
                onClick={() => act.mutate({ id: u.id, action: "approve" })}
                disabled={act.isPending}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                  background: "var(--positive)", color: "var(--surface-0)",
                  border: "none", opacity: act.isPending ? 0.6 : 1,
                }}
                data-testid={`approve-${u.username}`}
              >
                <Check size={13} /> Setujui
              </button>
            )}
            {u.status !== "REJECTED" && (
              <button
                onClick={() => act.mutate({ id: u.id, action: "reject" })}
                disabled={act.isPending}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: mono, fontSize: 12, fontWeight: 600,
                  padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                  background: "transparent", color: "var(--danger)",
                  border: "1px solid var(--danger)", opacity: act.isPending ? 0.6 : 1,
                }}
                data-testid={`reject-${u.username}`}
              >
                <X size={13} /> Tolak
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Users size={18} style={{ color: "var(--signal)" }} />
        <h1 style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, margin: 0 }}>Manajemen Pengguna</h1>
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)", marginBottom: 24 }}>
        Setujui registrasi untuk membuka seluruh fitur bagi pengguna.
      </p>

      {isLoading && (
        <p style={{ fontFamily: mono, fontSize: 13, color: "var(--signal)" }}>Memuat pengguna...</p>
      )}
      {error && (
        <p style={{ fontFamily: mono, fontSize: 13, color: "var(--danger)" }}>
          {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <div style={{
            background: "var(--surface-1)", border: "1px solid var(--border-2)",
            borderRadius: 10, overflow: "hidden", marginBottom: 24,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderBottom: "1px solid var(--border-1)",
              background: "var(--surface-2)",
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-2)" }}>
                MENUNGGU PERSETUJUAN
              </span>
              <span style={{
                fontFamily: mono, fontSize: 11, fontWeight: 700,
                color: pending.length ? "var(--warning)" : "var(--text-4)",
              }}>
                {pending.length}
              </span>
            </div>
            {pending.length === 0 ? (
              <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-4)", padding: "18px 16px" }}>
                Tidak ada registrasi baru.
              </p>
            ) : (
              pending.map((u) => <UserRow key={u.id} u={u} />)
            )}
          </div>

          <div style={{
            background: "var(--surface-1)", border: "1px solid var(--border-2)",
            borderRadius: 10, overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid var(--border-1)",
              background: "var(--surface-2)",
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-2)" }}>
                SEMUA AKUN
              </span>
            </div>
            {others.map((u) => <UserRow key={u.id} u={u} />)}
          </div>
        </>
      )}
    </div>
  );
}

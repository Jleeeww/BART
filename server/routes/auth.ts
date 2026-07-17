import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { users, authSessions, type User } from "@shared/schema";

// ── Password hashing (scrypt, no external deps) ──────────────────────────────
// Format: s2:<salthex>:<scrypt64hex> — same params as the seeded admin hash.
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS).toString("hex");
  return `s2:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "s2" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ── Sessions ─────────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.token, token), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

function publicUser(u: User) {
  return { id: u.id, username: u.username, role: u.role, status: u.status, createdAt: u.createdAt };
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

export function registerAuthRoutes(app: Express): void {
  // ── Register: account is created as PENDING; login works immediately but
  // features stay locked until an admin approves.
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body ?? {};
      if (typeof username !== "string" || !USERNAME_RE.test(username)) {
        return res.status(400).json({ error: "Username harus 3-32 karakter (huruf, angka, _ . -)" });
      }
      if (typeof password !== "string" || password.length < 4) {
        return res.status(400).json({ error: "Password minimal 4 karakter" });
      }
      const existing = await db.select({ id: users.id }).from(users)
        .where(eq(users.username, username.toLowerCase())).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "Username sudah terdaftar" });
      }
      const [created] = await db.insert(users).values({
        username: username.toLowerCase(),
        passwordHash: hashPassword(password),
        role: "user",
        status: "PENDING",
      }).returning();
      res.status(201).json({ user: publicUser(created) });
    } catch (err) {
      console.error("[auth] register error:", err);
      res.status(500).json({ error: "Registrasi gagal" });
    }
  });

  // ── Login: allowed for any non-rejected account regardless of approval.
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body ?? {};
      if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Username dan password wajib diisi" });
      }
      const [user] = await db.select().from(users)
        .where(eq(users.username, username.toLowerCase())).limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "Username atau password salah" });
      }
      if (user.status === "REJECTED") {
        return res.status(403).json({ error: "Registrasi akun ini ditolak admin" });
      }
      const token = crypto.randomBytes(32).toString("hex");
      await db.insert(authSessions).values({
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      res.status(200).json({ token, user: publicUser(user) });
    } catch (err) {
      console.error("[auth] login error:", err);
      res.status(500).json({ error: "Login gagal" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = bearerToken(req);
    if (token) await db.delete(authSessions).where(eq(authSessions.token, token));
    res.status(200).json({ ok: true });
  });

  // ── Current session (client polls this to detect approval flipping on).
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await getSessionUser(req);
      if (!user) return res.status(401).json({ error: "Sesi tidak valid" });
      res.status(200).json({ user: publicUser(user) });
    } catch (err) {
      console.error("[auth] me error:", err);
      res.status(500).json({ error: "Gagal memuat sesi" });
    }
  });

  // ── Admin: user management ─────────────────────────────────────────────────
  const requireAdminUser = async (req: Request, res: Response): Promise<User | null> => {
    const user = await getSessionUser(req);
    if (!user || user.role !== "admin") {
      res.status(user ? 403 : 401).json({ error: "Akses admin diperlukan" });
      return null;
    }
    return user;
  };

  app.get("/api/auth/admin/users", async (req: Request, res: Response) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;
      const all = await db.select().from(users).orderBy(desc(users.createdAt));
      res.status(200).json({ users: all.map(publicUser) });
    } catch (err) {
      console.error("[auth] list users error:", err);
      res.status(500).json({ error: "Gagal memuat pengguna" });
    }
  });

  app.post("/api/auth/admin/users/:id/approve", async (req: Request, res: Response) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;
      const id = parseInt(req.params.id, 10);
      const [updated] = await db.update(users)
        .set({ status: "APPROVED", approvedAt: new Date() })
        .where(eq(users.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      res.status(200).json({ user: publicUser(updated) });
    } catch (err) {
      console.error("[auth] approve error:", err);
      res.status(500).json({ error: "Gagal menyetujui pengguna" });
    }
  });

  app.post("/api/auth/admin/users/:id/reject", async (req: Request, res: Response) => {
    try {
      const admin = await requireAdminUser(req, res);
      if (!admin) return;
      const id = parseInt(req.params.id, 10);
      if (id === admin.id) return res.status(400).json({ error: "Tidak bisa menolak akun sendiri" });
      const [updated] = await db.update(users)
        .set({ status: "REJECTED", approvedAt: null })
        .where(eq(users.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Pengguna tidak ditemukan" });
      // Kill any live sessions for the rejected account.
      await db.delete(authSessions).where(eq(authSessions.userId, id));
      res.status(200).json({ user: publicUser(updated) });
    } catch (err) {
      console.error("[auth] reject error:", err);
      res.status(500).json({ error: "Gagal menolak pengguna" });
    }
  });
}

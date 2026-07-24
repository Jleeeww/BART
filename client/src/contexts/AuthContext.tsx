import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: number;
  username: string;
  role: "user" | "admin";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
}

const TOKEN_KEY = "bart_auth_token";

export const getAuthToken = (): string =>
  (typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) || "";

/** fetch() wrapper that injects the session Bearer token. */
export async function authFetch(method: string, url: string, data?: unknown): Promise<Response> {
  const token = getAuthToken();
  return fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

interface AuthCtx {
  user: AuthUser | null;
  /** true until the initial /api/auth/me check settles */
  loading: boolean;
  /** approved OR admin — gates every dashboard feature */
  isUnlocked: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await authFetch("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    } catch {
      // network error — keep whatever state we had
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // While a logged-in user is still PENDING, poll so approval unlocks live.
  useEffect(() => {
    if (!user || user.status !== "PENDING") return;
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Login gagal");
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    setLoading(false);
    return data.user as AuthUser;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Registrasi gagal");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch("POST", "/api/auth/logout");
    } catch {
      // best-effort — clear locally regardless
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const isUnlocked = !!user && (user.status === "APPROVED" || user.role === "admin");

  return (
    <AuthContext.Provider value={{ user, loading, isUnlocked, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

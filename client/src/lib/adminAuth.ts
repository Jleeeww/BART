// Lightweight admin auth for the runtime-config dashboard.
// Single shared token (set as ADMIN_TOKEN in the server .env), stored in
// localStorage and sent as a Bearer header on admin requests. Adequate for a
// single-admin pre-launch tool; upgrade to httpOnly-cookie sessions before
// exposing to untrusted networks.
const KEY = "bart_admin_token";

export const getAdminToken = (): string =>
  (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) || "";

export const setAdminToken = (t: string): void => {
  localStorage.setItem(KEY, t);
};

export const clearAdminToken = (): void => {
  localStorage.removeItem(KEY);
};

/** fetch() wrapper that injects the admin Bearer token. */
export async function adminFetch(method: string, url: string, data?: unknown): Promise<Response> {
  const token = getAdminToken();
  return fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
}

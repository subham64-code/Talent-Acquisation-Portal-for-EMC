import { useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, setLogoutCallback } from "../lib/api";
import { AuthContext, type User } from "./auth-context";

const CACHE_KEY = "emc.hr.session";

/** Last signed-in user, cached so a reload paints instantly instead of waiting on /auth/me. */
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.type ? (parsed as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable (private mode / quota) — ignore */
  }
}

/** Guarantees the user object always carries an account type so route guards work. */
function normalise(u: any): User | null {
  if (!u) return null;
  const type: "HR" | "CANDIDATE" = u.type ?? (u.roles?.length ? "HR" : "CANDIDATE");
  return { ...u, type, name: u.name ?? u.fullName ?? u.email } as User;
}

function isUnauthorized(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 401;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(readCachedUser);
  const [loading, setLoading] = useState(() => readCachedUser() === null);

  const setUser = useCallback((u: any) => {
    const next = normalise(u);
    setUserState(next);
    writeCachedUser(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then((r) => { if (!cancelled) setUser(r?.data?.user); })
      .catch((error) => {
        if (cancelled) return;
        // Only a real 401 clears the session; transient network/DB errors keep
        // the cached user so the portal stays usable and recovers on its own.
        if (isUnauthorized(error)) setUser(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setUser]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* session may already be gone */ }
    setUser(null);
    queryClient.clear();
  }, [queryClient, setUser]);

  // Any 401 triggers a silent /auth/me recheck before clearing the session.
  // A single transient 401 (DB hiccup) no longer kicks the user out mid-work;
  // only a genuinely dead session clears the UI.
  useEffect(() => {
    let rechecking = false;
    setLogoutCallback(() => {
      if (rechecking) return;
      rechecking = true;
      authApi.me()
        .then(() => { /* session still valid — keep the user signed in */ })
        .catch(() => setUser(null))
        .finally(() => { rechecking = false; });
    });
  }, [setUser]);

  const login = useCallback((u: User) => setUser(u), [setUser]);

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

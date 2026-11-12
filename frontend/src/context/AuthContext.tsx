import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { authApi, setLogoutCallback } from "../lib/api";

type User = { id: string; email: string; name: string; type: "HR" | "CANDIDATE"; roles?: string[]; permissions?: string[]; departments?: string[]; candidateCode?: string };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** Guarantees the user object always carries an account type so route guards work. */
  const normalise = (u: any): User | null => {
    if (!u) return null;
    const type: "HR" | "CANDIDATE" = u.type ?? (u.roles?.length ? "HR" : "CANDIDATE");
    return { ...u, type, name: u.name ?? u.fullName ?? u.email } as User;
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const r = await authApi.me();
        if (!cancelled) setUserState(normalise(r?.data?.user));
      } catch {
        if (!cancelled) setUserState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* session may already be gone */ }
    setUserState(null);
  }, []);

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
        .catch(() => setUserState(null))
        .finally(() => { rechecking = false; });
    });
  }, []);

  const login = useCallback((u: User) => {
    setUserState(normalise(u));
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser: (u) => setUserState(normalise(u)) }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

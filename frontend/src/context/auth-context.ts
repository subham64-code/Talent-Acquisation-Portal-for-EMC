import { createContext } from "react";

export type User = { id: string; email: string; name: string; type: "HR" | "CANDIDATE"; roles?: string[]; permissions?: string[]; departments?: string[]; candidateCode?: string };

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
}

/**
 * The context object lives in its own module so Fast Refresh of the provider
 * or hook never swaps the context identity (which would make consumers throw
 * "useAuth must be used within AuthProvider" during development).
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

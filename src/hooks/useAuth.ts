import { useState, useCallback, createContext, useContext } from "react";
import type { AuthUser } from "../types";
import { apiMe } from "../api";

const TOKEN_KEY = "aioffice_token";

export type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ pendingApproval?: boolean; blocked?: boolean }>;
  register: (companyName: string, email: string, password: string) => Promise<{ pendingApproval?: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function useAuthState() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem("aioffice_user");
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const persist = (token: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("aioffice_user", JSON.stringify(u));
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { ok: boolean; token?: string; user?: AuthUser; error?: string; message?: string };
      if (!res.ok) {
        if (data.error === "PENDING") return { pendingApproval: true };
        if (data.error === "BLOCKED") return { blocked: true };
        throw new Error(data.error ?? "Ошибка входа");
      }
      persist(data.token!, data.user!);
      // Redirect superadmin
      if (data.user?.isSuperadmin) {
        window.location.href = "/superadmin";
        return {};
      }
      return {};
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (companyName: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email, password }),
      });
      const data = await res.json() as { ok: boolean; pendingApproval?: boolean; token?: string; user?: AuthUser; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Ошибка регистрации");
      if (data.pendingApproval) return { pendingApproval: true };
      if (data.token && data.user) persist(data.token, data.user);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("aioffice_user");
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const data = await apiMe();
      localStorage.setItem("aioffice_user", JSON.stringify(data.user));
      setUser(data.user);
    } catch {
      logout();
    }
  }, [logout]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };
}

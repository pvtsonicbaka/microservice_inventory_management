import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "viewer";
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  canWrite: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // ignore — clear locally regardless
      }
    }
    localStorage.clear();
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "admin" || user?.role === "manager";
  const canWrite = isManager;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isAdmin, isManager, canWrite }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

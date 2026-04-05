import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, useRegister, useGetCurrentUser, setAuthTokenGetter } from "@workspace/api-client-react";
import type { LoginRequest, RegisterRequest, UserProfile } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function safeLocalStorage(op: "get" | "set" | "remove", key: string, value?: string): string | null {
  try {
    if (op === "get") return localStorage.getItem(key);
    if (op === "set" && value !== undefined) { localStorage.setItem(key, value); return null; }
    if (op === "remove") { localStorage.removeItem(key); return null; }
  } catch { /* localStorage blocked in some iframe contexts */ }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => safeLocalStorage("get", "sphere_token"));
  const tokenRef = useRef<string | null>(token);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Keep the ref always current so the auth getter always returns the latest token
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Register a stable token getter with customFetch — runs once on mount
  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  const setToken = (t: string | null) => {
    tokenRef.current = t;
    setTokenState(t);
    if (t) safeLocalStorage("set", "sphere_token", t);
    else safeLocalStorage("remove", "sphere_token");
  };

  const { data: user, isLoading: isUserLoading, isError: isAuthError } = useGetCurrentUser({
    query: {
      enabled: !!token,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  });

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  useEffect(() => {
    if (isAuthError && token) {
      // Token is invalid/expired — only logout on explicit API error
      handleLogout();
    }
  }, [isAuthError, token]);

  const handleLogin = async (data: LoginRequest) => {
    const response = await loginMutation.mutateAsync({ data });
    setToken(response.token);
    queryClient.setQueryData(["/api/auth/me"], response.user);
    queryClient.invalidateQueries();
    const dest = response.user?.role === "corporate" ? "/corporate/dashboard" : "/dashboard";
    setLocation(dest);
  };

  const handleRegister = async (data: RegisterRequest) => {
    const response = await registerMutation.mutateAsync({ data });
    setToken(response.token);
    queryClient.setQueryData(["/api/auth/me"], response.user);
    queryClient.invalidateQueries();
    const dest = response.user?.role === "corporate" ? "/corporate/dashboard" : "/dashboard";
    setLocation(dest);
  };

  const handleLogout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading: isUserLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

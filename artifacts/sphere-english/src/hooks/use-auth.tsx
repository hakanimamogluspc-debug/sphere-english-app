import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, useRegister, useGetCurrentUser, setAuthTokenGetter } from "@workspace/api-client-react";
import type { LoginRequest, RegisterRequest, UserProfile } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { setInterceptorToken, getInterceptorToken } from "@/lib/fetch-interceptor";

// Modül yüklendiğinde bir kez çalışır — React lifecycle'dan bağımsız
setAuthTokenGetter(() => getInterceptorToken());

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize token from interceptor (which already read from localStorage synchronously)
  const [token, setTokenState] = useState<string | null>(() => getInterceptorToken());
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const setToken = (t: string | null) => {
    setInterceptorToken(t);
    setTokenState(t);
  };

  const { data: user, isLoading: isUserLoading, error: authError } = useGetCurrentUser({
    query: {
      enabled: !!token,
      // Only retry on non-auth errors — network hiccups should not cause logout
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.response?.status;
        if (status === 401 || status === 403) return false; // Never retry auth failures
        return failureCount < 2; // Retry up to 2x for other errors (network, 5xx)
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      staleTime: 10 * 60 * 1000, // 10 minutes — reduce unnecessary re-fetches
      gcTime: 15 * 60 * 1000,
    }
  });

  useEffect(() => {
    if (!authError || !token) return;
    // Only force logout on genuine auth errors (HTTP 401/403)
    // Do NOT logout on network errors, timeouts, or server errors (5xx)
    const status = (authError as any)?.status ?? (authError as any)?.response?.status;
    if (status === 401 || status === 403) {
      handleLogout();
    }
    // For other errors (network, 500, etc.) — stay logged in, user can retry
  }, [authError, token]);

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

  const loginMutation = useLogin();
  const registerMutation = useRegister();

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

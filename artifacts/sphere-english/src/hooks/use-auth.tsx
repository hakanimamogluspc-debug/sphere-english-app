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

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, useRegister, useGetCurrentUser } from "@workspace/api-client-react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("sphere_token"));
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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
    localStorage.setItem("sphere_token", response.token);
    setToken(response.token);
    queryClient.setQueryData(["/api/auth/me"], response.user);
    const dest = response.user?.role === "corporate" ? "/corporate/dashboard" : "/dashboard";
    setLocation(dest);
  };

  const handleRegister = async (data: RegisterRequest) => {
    const response = await registerMutation.mutateAsync({ data });
    localStorage.setItem("sphere_token", response.token);
    setToken(response.token);
    queryClient.setQueryData(["/api/auth/me"], response.user);
    const dest = response.user?.role === "corporate" ? "/corporate/dashboard" : "/dashboard";
    setLocation(dest);
  };

  const handleLogout = () => {
    localStorage.removeItem("sphere_token");
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

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, useRegister, useGetCurrentUser, setAuthTokenGetter } from "@workspace/api-client-react";
import type { LoginRequest, RegisterRequest, UserProfile } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { setInterceptorToken, getInterceptorToken } from "@/lib/fetch-interceptor";
import { useToast } from "./use-toast";

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
  const { toast } = useToast();
  const logoutInFlightRef = useRef(false);

  const setToken = (t: string | null) => {
    setInterceptorToken(t);
    setTokenState(t);
  };

  const { data: user, isLoading: isUserLoading, error: authError } = useGetCurrentUser({
    query: {
      enabled: !!token,
      // 401/403 hariç hatalarda 2 defa tekrar dene (network hiccup vs)
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.response?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Demo/uzun oturum güvenliği: bir kez başarılı fetch'ten sonra
      // arka planda refetch yapma — user verisi 401 ile booted olmasın.
      // Profile değiştiğinde manuel `invalidateQueries` çağrılır.
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
      gcTime: Infinity,
    }
  });

  useEffect(() => {
    if (!authError || !token) return;
    const status = (authError as any)?.status ?? (authError as any)?.response?.status;
    // Sadece gerçek auth hatalarında (401/403) çıkış yap
    if (status === 401 || status === 403) {
      // Bir defa logout tetikleyince re-render'da tekrar tetiklenmesin
      if (logoutInFlightRef.current) return;
      logoutInFlightRef.current = true;

      // Kullanıcıya bilgilendirme — sessiz redirect yerine
      try {
        toast({
          title: "Oturum sona erdi",
          description: "Lütfen tekrar giriş yapın.",
          variant: "destructive",
        });
      } catch { /* toast yoksa sessizce devam */ }

      // Kısa bir gecikme: kullanıcı toast'u görsün
      setTimeout(() => {
        handleLogout();
        logoutInFlightRef.current = false;
      }, 1500);
    }
    // Network/5xx hatalarında oturumu kapatma — kullanıcı denesin
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
    const isCorporate = response.user?.role === "corporate";
    const isStudent = response.user?.role === "student";
    if (isCorporate) {
      setLocation("/corporate/dashboard");
    } else if (isStudent && !response.user?.company && !response.user?.placementTestCompleted) {
      setLocation("/placement-test");
    } else {
      setLocation("/dashboard");
    }
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

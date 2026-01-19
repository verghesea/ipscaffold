import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getStoredToken, clearStoredTokens, getTokenExpiration, refreshSession } from '@/lib/api';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  is_super_admin: boolean;
}

interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const token = getStoredToken();
  const { toast } = useToast();
  const [sessionWarningShown, setSessionWarningShown] = useState(false);

  const { data: user, isLoading, refetch } = useQuery<User>({
    queryKey: ['auth-user'],
    queryFn: () => api.getUser(),
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const profile: Profile | null = user ? {
    id: user.id,
    email: user.email,
    credits: user.credits,
    is_admin: user.isAdmin,
    is_super_admin: user.isSuperAdmin,
  } : null;

  const logout = () => {
    clearStoredTokens();
    queryClient.clear();
    navigate('/');
  };

  // Session monitoring - check every minute
  useEffect(() => {
    if (!token) return;

    const checkSession = async () => {
      const expiration = getTokenExpiration();
      if (!expiration) return;

      const now = new Date();
      const hoursUntilExpiry = (expiration.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Warn when 1 hour remaining
      if (hoursUntilExpiry < 1 && hoursUntilExpiry > 0 && !sessionWarningShown) {
        toast({
          title: 'Session expiring soon',
          description: "Your session will expire in less than 1 hour. You'll need to log in again.",
        });
        setSessionWarningShown(true);
      }

      // Auto-refresh when 30 minutes remaining
      if (hoursUntilExpiry < 0.5 && hoursUntilExpiry > 0) {
        const refreshed = await refreshSession();
        if (refreshed) {
          refetch();
          setSessionWarningShown(false);
        }
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    checkSession(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [token, sessionWarningShown, toast, refetch]);

  return (
    <AuthContext.Provider value={{
      user: user || null,
      profile,
      isLoading,
      isAuthenticated: !!user,
      logout,
      refetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
      logout: () => {},
      refetch: () => {},
    };
  }
  return context;
}

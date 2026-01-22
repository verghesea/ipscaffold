import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  displayName?: string | null;
  organization?: string | null;
  profileCompleted?: boolean;
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

// Session warning threshold: warn when less than 10 minutes remain
// This is appropriate for a 1-hour JWT - we don't want to warn immediately after login!
const SESSION_WARNING_MINUTES = 10;
// Auto-refresh threshold: refresh when less than 5 minutes remain
const SESSION_REFRESH_MINUTES = 5;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const token = getStoredToken();
  const { toast } = useToast();
  const [sessionWarningShown, setSessionWarningShown] = useState(false);
  // Track when the token was stored to avoid immediate warnings on fresh tokens
  const tokenAcquiredTime = useRef<number | null>(null);

  // Reset warning state when token changes (new login)
  useEffect(() => {
    if (token) {
      tokenAcquiredTime.current = Date.now();
      setSessionWarningShown(false);
    } else {
      tokenAcquiredTime.current = null;
    }
  }, [token]);

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

      const now = Date.now();
      const minutesUntilExpiry = (expiration.getTime() - now) / (1000 * 60);

      // Calculate how long we've had this token (to avoid warning on fresh tokens)
      const tokenAge = tokenAcquiredTime.current ? (now - tokenAcquiredTime.current) / (1000 * 60) : 0;

      // Only show warning if:
      // 1. Less than 10 minutes remaining
      // 2. Token is still valid (not expired)
      // 3. We haven't shown the warning yet
      // 4. Token has been held for at least 2 minutes (prevents warning on fresh login)
      if (
        minutesUntilExpiry < SESSION_WARNING_MINUTES &&
        minutesUntilExpiry > 0 &&
        !sessionWarningShown &&
        tokenAge > 2
      ) {
        console.log(`[Auth] Session warning: ${Math.round(minutesUntilExpiry)} minutes remaining`);
        toast({
          title: 'Session expiring soon',
          description: `Your session will expire in ${Math.round(minutesUntilExpiry)} minutes. Please save your work.`,
        });
        setSessionWarningShown(true);
      }

      // Auto-refresh when less than 5 minutes remaining
      if (minutesUntilExpiry < SESSION_REFRESH_MINUTES && minutesUntilExpiry > 0) {
        console.log(`[Auth] Attempting session refresh, ${Math.round(minutesUntilExpiry)} minutes remaining`);
        const refreshed = await refreshSession();
        if (refreshed) {
          console.log('[Auth] Session refreshed successfully');
          tokenAcquiredTime.current = Date.now(); // Reset token age
          refetch();
          setSessionWarningShown(false);
        } else {
          console.warn('[Auth] Session refresh failed');
        }
      }

      // If token is expired, clear it
      if (minutesUntilExpiry <= 0) {
        console.warn('[Auth] Token expired, logging out');
        logout();
      }
    };

    // Initial delay before first check - gives time for fresh login to settle
    const initialDelay = setTimeout(() => {
      checkSession();
    }, 5000); // Wait 5 seconds before first check

    // Then check every minute
    const interval = setInterval(checkSession, 60000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  // Note: logout is intentionally omitted from deps to prevent infinite loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

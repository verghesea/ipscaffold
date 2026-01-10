import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getStoredToken, clearStoredTokens } from '@/lib/api';
import { useLocation } from 'wouter';

interface Profile {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
}

interface User {
  id: string;
  email: string;
  credits: number;
  isAdmin: boolean;
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
  } : null;

  const logout = () => {
    clearStoredTokens();
    queryClient.clear();
    navigate('/');
  };

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

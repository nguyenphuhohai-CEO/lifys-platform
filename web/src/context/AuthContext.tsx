import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  categories: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    age: number;
    categories: string[];
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('lifys_user');
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('lifys_access_token')
  );

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('lifys_access_token', accessToken);
    } else {
      localStorage.removeItem('lifys_access_token');
    }
  }, [accessToken]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('lifys_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lifys_user');
    }
  }, [user]);

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
  }

  async function register(data: {
    email: string;
    password: string;
    firstName: string;
    age: number;
    categories: string[];
  }) {
    const res = await api.post('/auth/register', data);
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
  }

  const value = useMemo(
    () => ({ user, accessToken, login, register, logout }),
    [user, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

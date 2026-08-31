import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const utils = trpc.useUtils();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    try {
      // 1. Try server-side admin creation first (auto-confirms email)
      const res = await utils.client.auth.register.mutate({ email, password, name });
      if (res?.user) {
        // Log in immediately
        const loginRes = await supabase.auth.signInWithPassword({ email, password });
        if (loginRes.error) return { error: loginRes.error.message };
        return { error: null };
      }
    } catch (e: any) {
      if (e.message?.includes('already exists') || e.code === 'CONFLICT') {
        return { error: 'An account with this email already exists. Please sign in.' };
      }
      // Fallback to standard client sign up if server endpoint fails
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return { error: error.message };
    }

    // Try signing in immediately
    const loginRes = await supabase.auth.signInWithPassword({ email, password });
    if (loginRes.error) {
      if (loginRes.error.message.includes('Email not confirmed')) {
        return { error: 'Account created! Please check your email inbox to confirm, or contact admin.' };
      }
      return { error: loginRes.error.message };
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Email not confirmed. Please check your inbox or turn off email confirmation in Supabase.' };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!session,
      isLoading,
      signUp,
      signIn,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

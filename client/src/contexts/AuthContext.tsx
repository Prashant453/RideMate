import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

/**
 * Computes the environment-aware auth redirect URL.
 * Uses VITE_APP_URL if provided, then window.location.origin, with localhost fallback.
 */
export const getAuthRedirectUrl = (): string => {
  if (import.meta.env.VITE_APP_URL) {
    return import.meta.env.VITE_APP_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const utils = trpc.useUtils();

  useEffect(() => {
    // 1. Process URL hash / query auth parameters (such as email verification confirmation or errors)
    const handleUrlAuthParams = async () => {
      if (typeof window === 'undefined') return;

      const hashStr = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
      const searchStr = window.location.search ? window.location.search.replace(/^\?/, '') : '';

      const hashParams = new URLSearchParams(hashStr);
      const searchParams = new URLSearchParams(searchStr);

      const error = hashParams.get('error') || searchParams.get('error');
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
      const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');
      const type = hashParams.get('type') || searchParams.get('type');
      const accessToken = hashParams.get('access_token');
      const code = searchParams.get('code');

      // Check if there was an error in verification link
      if (error) {
        console.error('[Auth Callback Error]', { error, errorCode, errorDescription });
        if (
          errorCode === 'otp_expired' ||
          errorCode === 'otp_disabled' ||
          errorDescription?.toLowerCase().includes('expired') ||
          errorDescription?.toLowerCase().includes('already') ||
          errorDescription?.toLowerCase().includes('invalid')
        ) {
          toast.error('This verification link is invalid, expired, or has already been used. Please sign in or request a new confirmation email.', {
            duration: 7000,
          });
        } else {
          const message = errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
            : 'Email verification failed. Please try again.';
          toast.error(message, { duration: 6000 });
        }

        // Clean URL to prevent stale error messages
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // If PKCE authorization code is present in query parameters, exchange it
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[Auth Code Exchange Error]', exchangeError);
            toast.error('Failed to verify authentication code. Please try signing in again.', { duration: 6000 });
          } else if (data.session) {
            setSession(data.session);
            setUser(data.session.user);
            toast.success('Email verified successfully. You can now continue to RideMate.', {
              duration: 6000,
            });
          }
        } catch (err) {
          console.error('[Auth Code Exchange Exception]', err);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // If hash contains access token from signup confirmation link
      if (accessToken && (type === 'signup' || type === 'email_confirmation' || type === 'invite' || type === 'recovery')) {
        toast.success('Email verified successfully. You can now continue to RideMate.', {
          duration: 6000,
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleUrlAuthParams();

    // 2. Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
    });

    // 3. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        utils.invalidate();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Email not confirmed. Please check your inbox for the confirmation link.' };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const resendVerificationEmail = async (email: string) => {
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const logout = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        }
      }
    } catch (err) {
      console.error('Error removing push subscription during logout', err);
    }
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
      resendVerificationEmail,
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

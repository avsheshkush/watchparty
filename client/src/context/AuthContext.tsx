import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../supabase";
import { saveUsername } from "../utils/storage";

export interface AuthUserProfile {
  id: string;
  email?: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUserProfile | null;
  supabaseUser: User | null;
  session: Session | null;
  token: string | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  devLogin: (displayName: string, email?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEV_AUTH_KEY = "watchparty_dev_auth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  // Helper to extract display name from Supabase user
  const extractProfile = (su: User): AuthUserProfile => {
    const displayName =
      su.user_metadata?.displayName ||
      su.user_metadata?.username ||
      (su.email ? su.email.split("@")[0] : `user_${su.id.slice(0, 6)}`);
    return {
      id: su.id,
      email: su.email,
      displayName,
    };
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isConfigured && supabase) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.warn("[Auth] Failed to restore Supabase session:", error.message);
          } else if (data.session && mounted) {
            setSession(data.session);
            setSupabaseUser(data.session.user);
            setToken(data.session.access_token);
            const prof = extractProfile(data.session.user);
            setUser(prof);
            saveUsername(prof.displayName);
          }
        } catch (err) {
          console.error("[Auth] Session restoration error:", err);
        }

        // Listen for realtime auth changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (!mounted) return;
          if (newSession) {
            setSession(newSession);
            setSupabaseUser(newSession.user);
            setToken(newSession.access_token);
            const prof = extractProfile(newSession.user);
            setUser(prof);
            saveUsername(prof.displayName);
          } else {
            setSession(null);
            setSupabaseUser(null);
            setUser(null);
            setToken(null);
          }
        });

        if (mounted) setIsLoading(false);

        return () => {
          subscription.unsubscribe();
        };
      } else {
        // Fallback for dev mode / tests without configured remote Supabase keys
        const savedDev = localStorage.getItem(DEV_AUTH_KEY);
        if (savedDev && mounted) {
          try {
            const parsed = JSON.parse(savedDev);
            setUser(parsed.user);
            setToken(parsed.token);
            saveUsername(parsed.user.displayName);
          } catch {
            localStorage.removeItem(DEV_AUTH_KEY);
          }
        }
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, [isConfigured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isConfigured || !supabase) {
        throw new Error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setSupabaseUser(data.session.user);
          setToken(data.session.access_token);
          const prof = extractProfile(data.session.user);
          setUser(prof);
          saveUsername(prof.displayName);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isConfigured]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (!isConfigured || !supabase) {
        throw new Error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
      }
      setIsLoading(true);
      try {
        const trimmedName = displayName.trim() || email.split("@")[0];
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              displayName: trimmedName,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          setSession(data.session);
          setSupabaseUser(data.session.user);
          setToken(data.session.access_token);
          const prof = extractProfile(data.session.user);
          setUser(prof);
          saveUsername(prof.displayName);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isConfigured]
  );

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem(DEV_AUTH_KEY);
      setSession(null);
      setSupabaseUser(null);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  const devLogin = useCallback((displayName: string, email?: string) => {
    const cleanName = displayName.trim() || "DevExplorer";
    const cleanEmail = email?.trim() || `${cleanName.toLowerCase().replace(/\s+/g, "_")}@watchparty.local`;
    const devId = "dev_" + Math.random().toString(36).substring(2, 9);
    const mockToken = `demo-token:${devId}:${encodeURIComponent(cleanName)}:${encodeURIComponent(cleanEmail)}`;

    const profile: AuthUserProfile = {
      id: devId,
      email: cleanEmail,
      displayName: cleanName,
    };

    localStorage.setItem(DEV_AUTH_KEY, JSON.stringify({ user: profile, token: mockToken }));
    setUser(profile);
    setToken(mockToken);
    saveUsername(cleanName);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        token,
        isLoading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        devLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

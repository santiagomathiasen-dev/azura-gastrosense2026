import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  loginWithGoogle: (redirectTo?: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // 2. Check for initial session (and allow hash parsing)
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        setSession(session);
        setUser(session.user);
      }
      setIsLoading(false);
    };

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!email || !password) {
      return { error: 'Por favor, preencha todos os campos' };
    }

    if (password.length < 6) {
      return { error: 'Senha deve ter pelo menos 6 caracteres' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Handle common error messages
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Email ou senha incorretos' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Por favor, confirme seu email antes de fazer login' };
      }
      return { error: error.message };
    }

    return {};
  };

  const signup = async (email: string, password: string, name: string): Promise<{ error?: string }> => {
    if (!email || !password || !name) {
      return { error: 'Por favor, preencha todos os campos' };
    }

    if (password.length < 6) {
      return { error: 'Senha deve ter pelo menos 6 caracteres' };
    }

    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name: name.trim(),
        },
      },
    });

    if (error) {
      if (error.message.includes('User already registered')) {
        return { error: 'Este email já está cadastrado' };
      }
      return { error: error.message };
    }

    if (data.session) {
      return { error: undefined }; // Account created and logged in automatically
    }

    return { error: 'Conta criada com sucesso! Verifique seu email para confirmar o cadastro (se necessário).' };
  };

  const loginWithGoogle = async (redirectTo?: string): Promise<{ error?: string }> => {
    const redirectUrl = `${window.location.origin}${redirectTo || '/'}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return {};
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro interno no signOut do Supabase:", error);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

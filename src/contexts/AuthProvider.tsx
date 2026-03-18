'use client';

import { useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { AuthContext } from './AuthContext';

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

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });

        if (error) {
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

        const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/`;

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
            return { error: undefined };
        }

        return { error: 'Conta criada com sucesso! Verifique seu email para confirmar o cadastro (se necessário).' };
    };

    const loginWithGoogle = async (redirectTo?: string): Promise<{ error?: string }> => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const nextPath = redirectTo || '/dashboard';
        const callbackUrl = `${origin}/auth/v1/callback?next=${encodeURIComponent(nextPath)}`;
        
        console.log("AuthProvider: Current Origin:", origin);
        console.log("AuthProvider: Initiating Google Login with redirect:", callbackUrl);

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: callbackUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) {
            console.error("AuthProvider: Google Login Error:", error);
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

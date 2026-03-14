import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ error?: string }>;
    signup: (email: string, password: string, name: string) => Promise<{ error?: string }>;
    loginWithGoogle: (redirectTo?: string) => Promise<{ error?: string }>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

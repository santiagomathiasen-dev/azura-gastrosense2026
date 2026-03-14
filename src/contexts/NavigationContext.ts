'use client';

import { createContext, useContext } from 'react';

export type NavigateFunction = (to: string | number, options?: { replace?: boolean; state?: any }) => void;

interface NavigationContextType {
    navigate: NavigateFunction;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function useAppNavigation() {
    const context = useContext(NavigationContext);
    if (context === undefined) {
        // Fallback for components used outside providers (e.g. tests)
        return (to: string | number) => {
            if (typeof window !== 'undefined') {
                if (typeof to === 'string') window.location.href = to;
                else window.history.back();
            }
        };
    }
    return context.navigate;
}

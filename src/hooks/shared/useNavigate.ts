'use client';

import { useAppNavigation } from '@/contexts/NavigationContext';

/**
 * Compatibility hook for useNavigate.
 * Uses NavigationContext to bridge Vite/Next.js architectures.
 */
export function useNavigate() {
    return useAppNavigation();
}

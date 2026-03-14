'use client';

import { createContext, useContext } from 'react';
import { Collaborator } from '@/hooks/useCollaborators';

export interface CollaboratorContextType {
    collaborator: Collaborator | null;
    gestorId: string | null;
    impersonatedGestorId: string | null;
    isCollaboratorMode: boolean;
    isImpersonating: boolean;
    setCollaboratorSession: (collaborator: Collaborator, gestorId: string) => void;
    setImpersonation: (gestorId: string) => void;
    clearCollaboratorSession: () => void;
    stopImpersonation: () => void;
    hasAccess: (route: string) => boolean;
}

export const CollaboratorContext = createContext<CollaboratorContextType | undefined>(undefined);

export function useCollaboratorContext() {
    const context = useContext(CollaboratorContext);
    if (context === undefined) {
        throw new Error('useCollaboratorContext must be used within a CollaboratorProvider');
    }
    return context;
}

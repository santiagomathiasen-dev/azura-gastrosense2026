import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isCollaboratorMode, hasAccess } = useCollaboratorContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profile, isLoading: profileLoading } = useProfile();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const location = useLocation();

  // Optimized loading check: 
  // We only wait for auth to finish initially. 
  // Role and profile can load "in the background" unless we are on a page that strictly requires them.
  const isEssentialLoading = authLoading;
  const isSecondaryLoading = roleLoading || profileLoading;

  // EMERGENCY BYPASS: If the authenticated user is the admin, 
  // we bypass loading guards to prevent the "Otimizando" hang.
  const isAdminBypass = user?.email === 'santiago.aloom@gmail.com';

  useEffect(() => {
    let timer: any;
    if ((isEssentialLoading || isSecondaryLoading) && !isAdminBypass) {
      timer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 10000); // 10 seconds timeout
    }
    return () => clearTimeout(timer);
  }, [isEssentialLoading, isSecondaryLoading, isAdminBypass]);

  // If essential auth is loading, show minimal loader
  if (isEssentialLoading && !showTimeoutMessage && !isAdminBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }


  // Handle stuck loading
  if (showTimeoutMessage && (isEssentialLoading || isSecondaryLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-xl font-bold">Otimizando carregamento...</h1>
          <p className="text-muted-foreground">O sistema está verificando suas permissões.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="bg-primary text-primary-foreground px-4 py-2 rounded-md">
              Recarregar Sistema
            </button>
            <button onClick={() => setShowTimeoutMessage(false)} className="text-sm underline">
              Tentar entrar mesmo assim
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!authLoading && !user && !isCollaboratorMode) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If we are logged in but profile is still loading, 
  // we can show a lighter loader or just continue to layout 
  // if the layout handles missing profile gracefully.
  if (isSecondaryLoading && !profile && !isAdmin && !isAdminBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Check payment/active status for non-admin profiles
  const isSantiago = profile?.email === 'santiago.aloom@gmail.com';
  const isBlocked = profile?.status === 'inativo';
  const isPaymentPending = profile?.status_pagamento === false;

  // Admins and Santiago are never blocked/payment-restricted here for management purposes
  if (user && !isAdmin && !isSantiago && profile) {
    if (isBlocked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
            <p className="text-muted-foreground">Sua conta foi desativada pelo administrador.</p>
            <Navigate to="/auth" replace />
          </div>
        </div>
      );
    }

    if (isPaymentPending && location.pathname !== '/payment-required') {
      return <Navigate to="/payment-required" replace />;
    }
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}


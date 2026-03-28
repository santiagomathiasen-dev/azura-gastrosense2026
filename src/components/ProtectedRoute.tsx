import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

function Navigate({ to, replace }: { to: string, replace?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (replace) router.replace(to);
    else router.push(to);
  }, [to, replace, router]);
  return null;
}

import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isCollaboratorMode, hasAccess } = useCollaboratorContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profile, isLoading: profileLoading } = useProfile();
  const { isTrialExpired } = usePlanLimits();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const pathname = usePathname();

  // Optimized loading check: 
  // We only wait for auth to finish initially. 
  // Role and profile can load "in the background" unless we are on a page that strictly requires them.
  const isEssentialLoading = authLoading;
  const isSecondaryLoading = roleLoading || profileLoading;

  // BYPASS: If auth is done and user is logged in, never block on secondary loading.
  // roleLoading/profileLoading are background processes and should not hang navigation.
  const isAdminBypass = !!user;

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
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <p className="text-muted-foreground animate-pulse">Carregando sistema Azura...</p>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/auth';
            }}
            className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors underline"
          >
            Se demorar muito, clique aqui para resetar
          </button>
        </div>
      </div>
    );
  }


  // Handle stuck loading
  if (showTimeoutMessage && (isEssentialLoading || isSecondaryLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full p-4 text-center">
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
    return <Navigate to={`/auth?from=${pathname}`} replace />;
  }

  // If we are logged in but profile is still loading,
  // ONLY block if there is truly no user session at all.
  // Never block an authenticated user on background profile/role loading.
  if (isSecondaryLoading && !profile && !isAdmin && !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Check payment/active status for non-admin profiles
  const isSantiago = isAdmin; // Admins bypass payment restriction; removed hardcoded emails
  const isBlocked = profile?.status === 'inativo';
  // If status_pagamento is false OR subscription_end_date is in the past
  const isPaymentPending = profile?.status_pagamento === false || (profile?.subscription_end_date && new Date(profile.subscription_end_date) < new Date());

  // Admins and Santiago are never blocked/payment-restricted here for management purposes
  if (user && !isAdmin && !isSantiago && profile) {
    if (isBlocked) {
      console.log("ProtectedRoute: User is blocked (inativo)");
      return (
        <div className="flex items-center justify-center min-h-[60vh] w-full p-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
            <p className="text-muted-foreground">Sua conta foi desativada pelo administrador.</p>
            <button onClick={() => window.location.href = '/auth'} className="text-sm underline mt-4">
              Voltar ao Login
            </button>
          </div>
        </div>
      );
    }

    // Block expired Grátis trial users
    if ((isTrialExpired || isPaymentPending) && pathname !== '/payment-required') {
      console.log("ProtectedRoute: Trial/payment expired → /payment-required");
      return <Navigate to="/payment-required" replace />;
    }
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}


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

import { useAuth } from '@/hooks/shared/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/shared/useUserRole';
import { useProfile } from '@/hooks/shared/useProfile';
import { usePlanLimits } from '@/hooks/shared/usePlanLimits';
import { Loader2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isCollaboratorMode, hasAccess } = useCollaboratorContext();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { profile, isLoading: profileLoading } = useProfile();
  const {
    shouldBlockAccess,
    isSubscriptionExpiring,
    daysUntilExpiry,
    trialDaysRemaining,
    isFree,
    isTrialExpired,
  } = usePlanLimits();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [permissionsLoadingTimeout, setPermissionsLoadingTimeout] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const pathname = usePathname();

  const isEssentialLoading = authLoading;
  const isSecondaryLoading = roleLoading || profileLoading;
  const isAdminBypass = !!user;

  // Timeout para essencial (autenticação principal)
  useEffect(() => {
    let timer: any;
    if (isEssentialLoading && !isAdminBypass) {
      timer = setTimeout(() => {
        console.warn('⚠️ Auth loading timeout after 10s');
        setShowTimeoutMessage(true);
      }, 10000);
    }
    return () => clearTimeout(timer);
  }, [isEssentialLoading, isAdminBypass]);

  // Timeout para permissões secundárias (profile, role, limits)
  // **CRÍTICO**: Não bloqueia indefinidamente - após 8s, permite entrada mesmo sem dados completos
  useEffect(() => {
    let timer: any;
    if (user && isSecondaryLoading && !profile) {
      timer = setTimeout(() => {
        console.warn('⚠️ Permission/profile loading timeout after 8s - allowing entry with partial data');
        setPermissionsLoadingTimeout(true);
      }, 8000);
    }
    return () => clearTimeout(timer);
  }, [user, isSecondaryLoading, profile]);

  // If essential auth is loading, show minimal loader
  if (isEssentialLoading && !showTimeoutMessage && !isAdminBypass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <p className="text-muted-foreground animate-pulse">Carregando sistema Azura...</p>
          <p className="text-xs text-muted-foreground/70">Aguarde enquanto verificamos sua sessão</p>
          <button
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/auth';
            }}
            className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors underline mt-2"
          >
            Se demorar muito, clique aqui para resetar
          </button>
        </div>
      </div>
    );
  }

  // Handle stuck loading on auth
  if (showTimeoutMessage && isEssentialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full p-4 bg-background">
        <div className="max-w-md space-y-4 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto" />
          <h1 className="text-xl font-bold">Autenticação Lenta</h1>
          <p className="text-muted-foreground text-sm">
            A verificação de sua sessão está demorando mais que o esperado.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar Sistema
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/auth';
              }}
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              Voltar ao Login
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

  // ⭐ CRITICAL FIX: Se permissões estão TIMEOUT, permite entrada com aviso
  // O componente NÃO fica mais travado em "Verificando permissoes..."
  const permissionsHaveTimedOut = permissionsLoadingTimeout && isSecondaryLoading && !profile;
  const shouldAllowPartialEntry = user && (profile || permissionsHaveTimedOut);

  // Mostrar aviso durante carregamento de permissões (sem bloquear)
  const permissionLoadingWarning = user && isSecondaryLoading && !profile && !permissionsHaveTimedOut && (
    <div className="fixed top-0 left-0 right-0 z-40 bg-blue-500/10 border-b border-blue-500/30 px-4 py-3 flex items-center gap-3">
      <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
      <p className="text-sm text-blue-700 dark:text-blue-400 flex-1">
        Carregando suas permissões...
      </p>
    </div>
  );

  const permissionTimeoutWarning = user && permissionsHaveTimedOut && (
    <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 flex items-center gap-3 sticky top-0 z-40">
      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
          Verificação de permissões demorada
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
          Algumas informações podem não estar atualizadas. Tente recarregar em alguns instantes.
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity whitespace-nowrap ml-2"
      >
        Recarregar
      </button>
    </div>
  );

  // Check blocked accounts
  const isOwner = (profile?.role as string) === 'owner';
  const isAdminRole = (profile?.role as string) === 'admin';
  const isBlocked = profile?.status === 'inativo' && profile?.status_pagamento !== true;

  if (user && !isOwner && !isAdminRole && profile) {
    if (isBlocked) {
      return (
        <div className="flex items-center justify-center min-h-screen w-full p-4 text-center bg-background">
          <div className="max-w-md space-y-4">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">Conta Bloqueada</h1>
            <p className="text-muted-foreground">Sua conta foi desativada pelo administrador.</p>
            <button
              onClick={() => window.location.href = '/auth'}
              className="text-sm underline mt-4 hover:text-foreground transition-colors"
            >
              Voltar ao Login
            </button>
          </div>
        </div>
      );
    }

    // Block access if trial expired or subscription expired
    // ⭐ Mas, se permissões estão em timeout, não bloqueia - deixa o usuário entrar
    if (shouldBlockAccess && !permissionsHaveTimedOut && pathname !== '/payment-required' && pathname !== '/assinatura') {
      return <Navigate to="/payment-required" replace />;
    }
  }

  // Check route permission for collaborators
  if (isCollaboratorMode && !hasAccess(pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Build warning banner for subscription/trial
  let warningBanner = null;

  if (user && profile && !isOwner && (profile?.role as string) !== 'colaborador') {
    if (isSubscriptionExpiring && daysUntilExpiry !== null) {
      warningBanner = (
        <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              Sua assinatura expira em {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}!
            </p>
            <p className="text-xs opacity-80">Renove para continuar usando o sistema sem interrupcoes.</p>
          </div>
          <a href="/assinatura" className="text-xs font-semibold underline whitespace-nowrap">
            Renovar
          </a>
        </div>
      );
    } else if (isFree && !isTrialExpired && trialDaysRemaining !== null && trialDaysRemaining <= 3) {
      warningBanner = (
        <div className="bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400 px-4 py-3 rounded-lg mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">
              Seu periodo de teste termina em {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia' : 'dias'}!
            </p>
            <p className="text-xs opacity-80">Assine um plano para manter o acesso.</p>
          </div>
          <a href="/assinatura" className="text-xs font-semibold underline whitespace-nowrap">
            Ver Planos
          </a>
        </div>
      );
    }
  }

  // ⭐ PERMITE ENTRADA MESMO SEM DADOS COMPLETOS
  // Se usuario está autenticado e permissões estão OK (ou timeout), renderiza o conteúdo
  if (shouldAllowPartialEntry || (user && !isSecondaryLoading)) {
    return (
      <>
        {permissionTimeoutWarning}
        {permissionLoadingWarning}
        {warningBanner}
        {children}
      </>
    );
  }

  // Fallback: se ainda está carregando essencial, mostraloader
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Não deveria chegar aqui, mas é seguro
  return null;
}

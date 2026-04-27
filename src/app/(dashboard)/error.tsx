'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary scoped to the (dashboard) layout.
 * Catches errors that occur inside the dashboard section (ProtectedRoute,
 * profile/role hooks, etc.) and shows a recovery UI instead of letting
 * them propagate to the global error page.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error for debugging without crashing the UI
        const isAbortLike =
            error?.name === 'AbortError' ||
            error?.message?.includes('aborted') ||
            error?.message?.includes('signal');

        if (!isAbortLike) {
            console.error('[DashboardError]', error);
        }
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>

            <div className="space-y-2 max-w-sm">
                <h2 className="text-xl font-semibold">Erro ao carregar o painel</h2>
                <p className="text-sm text-muted-foreground">
                    Ocorreu um erro inesperado. Isso costuma ser causado por uma instabilidade
                    momentânea na sessão. Tente recarregar.
                </p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button onClick={reset} className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar novamente
                </Button>
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                        localStorage.clear();
                        sessionStorage.clear();
                        window.location.href = '/auth';
                    }}
                >
                    Voltar ao login
                </Button>
            </div>
        </div>
    );
}

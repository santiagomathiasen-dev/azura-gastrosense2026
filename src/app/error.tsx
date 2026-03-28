'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[GlobalError]', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center gap-4 bg-background">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">Algo deu errado</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Ocorreu um erro inesperado. Tente recarregar a página.
                </p>
            </div>
            <Button variant="outline" onClick={reset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
            </Button>
        </div>
    );
}

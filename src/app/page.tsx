'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const Landing = dynamic(() => import('@/v-pages/Landing'), {
    loading: () => (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
                <p className="text-muted-foreground animate-pulse text-sm">Carregando...</p>
            </div>
        </div>
    ),
    ssr: false,
});

export default function NextLanding() {
    return <Landing />;
}

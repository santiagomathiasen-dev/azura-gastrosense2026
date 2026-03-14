'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthProvider';
import { NavigationProvider } from '@/contexts/NavigationProvider';
import { CollaboratorProvider } from '@/contexts/CollaboratorProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,
                        gcTime: 30 * 60 * 1000,
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <NavigationProvider
                    navigate={(to, options) => {
                        if (typeof to === 'number') {
                            if (to === -1) router.back();
                            return;
                        }
                        if (options?.replace) {
                            router.replace(to);
                        } else {
                            router.push(to);
                        }
                    }}
                >
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="light"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <CollaboratorProvider>
                            <TooltipProvider>
                                {children}
                                <Toaster position="top-right" richColors closeButton />
                            </TooltipProvider>
                        </CollaboratorProvider>
                    </ThemeProvider>
                </NavigationProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}

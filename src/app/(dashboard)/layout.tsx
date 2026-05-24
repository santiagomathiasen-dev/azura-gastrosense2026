'use client';

import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DriveDataProvider } from '@/contexts/DriveDataContext';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const isProductionApp = pathname === '/producao-app';

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar */}
            {!isProductionApp && (
                <div className={`hidden md:flex flex-col fixed inset-y-0 z-50 border-r border-border/50 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
                    <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
                </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isProductionApp ? "md:ml-0" : collapsed ? "md:ml-16" : "md:ml-64"}`}>
                {/* Mobile Nav */}
                {!isProductionApp && (
                    <div className="md:hidden">
                        <MobileNav />
                    </div>
                )}

                <main className={`flex-1 animate-in fade-in duration-500 overflow-y-auto overflow-x-hidden ${isProductionApp ? "p-0" : "p-4 md:p-8"}`}>
                    <div className={`${isProductionApp ? "w-full max-w-full pb-0" : "max-w-7xl mx-auto pb-8"}`}>
                        <ProtectedRoute>
                            <DriveDataProvider>
                                {children}
                            </DriveDataProvider>
                        </ProtectedRoute>
                    </div>
                </main>
            </div>
        </div>
    );
}

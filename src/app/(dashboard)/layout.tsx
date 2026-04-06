'use client';

import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DriveDataProvider } from '@/contexts/DriveDataContext';
import { useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Desktop Sidebar */}
            <div className={`hidden md:flex flex-col fixed inset-y-0 z-50 border-r border-border/50 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
                <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
            </div>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "md:ml-16" : "md:ml-64"}`}>
                {/* Mobile Nav */}
                <div className="md:hidden">
                    <MobileNav />
                </div>

                <main className="flex-1 p-4 md:p-8 animate-in fade-in duration-500 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-7xl mx-auto pb-8">
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

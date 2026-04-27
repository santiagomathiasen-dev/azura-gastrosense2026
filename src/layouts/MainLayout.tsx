import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { MobileHeader } from '@/components/MobileHeader';
import { useGlobalRealtimeSync } from '@/hooks/shared/useRealtimeSubscription';
import { useState } from 'react';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIAssistant } from '@/components/AIAssistant';

export function MainLayout() {
  const { isImpersonating, stopImpersonation } = useCollaboratorContext();
  const [collapsed, setCollapsed] = useState(false);
  // Enable global realtime sync for all data tables
  useGlobalRealtimeSync();


  return (
    <div className="h-screen flex w-full bg-background overflow-hidden relative flex-col md:flex-row">
      {isImpersonating && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between z-50 w-full fixed top-0 left-0 h-10 md:h-12">
          <div className="flex items-center gap-2 text-primary text-sm font-medium">
            <span className="animate-pulse">●</span>
            Modo de Visualização Administrador
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={stopImpersonation}
            className="h-7 text-primary hover:bg-primary/20 flex items-center gap-1 text-xs"
          >
            <XCircle className="h-4 w-4" />
            Sair
          </Button>
        </div>
      )}
      <div className={`flex w-full h-full relative ${isImpersonating ? 'pt-10 md:pt-12' : ''}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <MobileNav />
        <div className={cn(
          "flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300",
          "ml-16", // Base margin for MobileNav (fixed on left)
          collapsed ? "md:ml-16" : "md:ml-64" // Dynamic margin for desktop Sidebar
        )}>
          <MobileHeader />
          <main className="flex-1 p-2 md:p-4 w-full overflow-y-auto overflow-x-hidden" style={{ fontSize: '75%' }}>
            <div className="max-w-7xl mx-auto pb-8">
              <Outlet />
            </div>
            <AIAssistant />
          </main>
        </div>
      </div>
    </div>
  );
}

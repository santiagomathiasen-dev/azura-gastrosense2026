import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  FileText,
  Factory,
  ShoppingCart,
  LogOut,
  Boxes,
  PackageCheck,
  ShoppingBag,
  Users,
  BarChart3,
  TrendingDown,
  Calculator,
  UtensilsCrossed,
  UserCog,
  Store,
  Zap,
  CalendarClock,
  CreditCard
} from 'lucide-react';
import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { ScrollArea } from '@/components/ui/scroll-area';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Painel', permission: 'can_access_dashboard' },
  { to: '/estoque', icon: Package, label: 'Central', permission: 'can_access_estoque' },
  { to: '/estoque-producao', icon: Boxes, label: 'Est. Prod.', permission: 'can_access_estoque_producao' },
  { to: '/fichas', icon: FileText, label: 'Fichas', permission: 'can_access_fichas' },
  { to: '/producao', icon: Factory, label: 'Produção', permission: 'can_access_producao' },
  { to: '/previsao-vendas', icon: CalendarClock, label: 'Previsões', permission: 'can_access_producao' },
  { to: '/compras', icon: ShoppingCart, label: 'Compras', permission: 'can_access_compras' },
  { to: '/estoque-insumos-produzidos', icon: UtensilsCrossed, label: 'Insumos', permission: 'can_access_estoque_producao' },
  { to: '/estoque-finalizados', icon: PackageCheck, label: 'Finaliz.', permission: 'can_access_finalizados' },
  { to: '/perdas', icon: TrendingDown, label: 'Perdas', permission: 'can_access_estoque' },
  { to: '/praca-quente', icon: Zap, label: 'Praça Q.', permission: 'can_access_produtos_venda' },
  { to: '/produtos-venda', icon: ShoppingBag, label: 'Venda', permission: 'can_access_produtos_venda' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', permission: 'can_access_relatorios' },
  { to: '/financeiro', icon: Calculator, label: 'Financeiro', permission: 'can_access_financeiro' },
  { to: '/assinatura', icon: CreditCard, label: 'Assinatura', permission: null },
  { to: '/colaboradores', icon: UserCog, label: 'Colab.', permission: null, managementOnly: true },
  { to: '/gestores', icon: Store, label: 'Gestores', permission: null, managementOnly: true, adminOnly: true },
];

export function MobileNav() {
  const { logout } = useAuth();
  const { isCollaboratorMode, clearCollaboratorSession, hasAccess } = useCollaboratorContext();
  const { isAdmin, isGestor } = useUserRole();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    // If in collaborator mode, clear session first
    if (isCollaboratorMode) {
      clearCollaboratorSession();
    }
    await logout();
    // Use full page reload to avoid React unmount issues
    setTimeout(() => {
      window.location.href = '/auth';
    }, 0);
  };

  const visibleNavItems = [
    ...navItems.filter(item => {
      // adminOnly é exclusivo para admins
      if ((item as any).adminOnly) return isAdmin || isGestor || !isAdmin; // Temporarily permissive
      if (item.managementOnly) {
        if (isCollaboratorMode) return false;
        return isAdmin || isGestor || true; // Force show management for testing
      }
      if (isCollaboratorMode && item.permission) {
        return hasAccess(item.to);
      }
      return true;
    }),
  ];

  return (
    <nav className="md:hidden fixed left-0 top-14 bottom-0 w-16 bg-card border-r border-border z-50 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center py-2 gap-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                href={item.to}
                className={
                  cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-14",
                    isActive && "text-primary bg-primary/10"
                  )
                }
              >
                <item.icon className="h-6 w-6" />
                <span className="text-[10px] leading-none mt-1 text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center justify-center p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="h-6 w-6" />
          <span className="text-[10px] leading-none mt-1">Sair</span>
        </button>
      </div>
    </nav>
  );
}

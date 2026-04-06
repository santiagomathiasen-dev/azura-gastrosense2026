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
  BarChart3,
  TrendingDown,
  Calculator,
  UtensilsCrossed,
  UserCog,
  Zap,
  CalendarClock,
  CreditCard,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfile } from '@/hooks/useProfile';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission: string | null;
  managementOnly?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
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
  { to: '/admin', icon: Shield, label: 'Admin', permission: null, adminOnly: true },
];

export function MobileNav() {
  const { logout } = useAuth();
  const { isCollaboratorMode, clearCollaboratorSession, hasAccess } = useCollaboratorContext();
  const { isAdmin, isGestor } = useUserRole();
  const { profile } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  const isOwner = (profile?.role as string) === 'owner';

  const handleLogout = async () => {
    if (isCollaboratorMode) {
      clearCollaboratorSession();
    }
    await logout();
    setTimeout(() => {
      window.location.href = '/auth';
    }, 0);
  };

  // Same filtering logic as Sidebar for consistency
  const visibleNavItems = navItems.filter((item: NavItem) => {
    // Owner and admin always see everything
    if (isOwner || isAdmin) return true;

    // Gestor sees everything except admin-only items
    if (isGestor) return !item.adminOnly;

    // Admin-only items require admin/owner role
    if (item.adminOnly) return false;
    // Management-only items require admin or gestor role
    if (item.managementOnly) return false;

    // Collaborator mode — check explicit permission
    if (isCollaboratorMode) {
      if (item.permission) return hasAccess(item.to);
      return item.to === '/dashboard';
    }

    // Regular user — show standard items
    return true;
  });

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

'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { NavigationLink } from '@/components/NavigationLink';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  FileText,
  Factory,
  CalendarClock,
  ShoppingCart,
  PackageCheck,
  ShoppingBag,
  TrendingDown,
  BarChart3,
  Calculator,
  UserCog,
  Store,
  Zap,
  ShieldCheck,
  Shield,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/shared/useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useUserRole } from '@/hooks/shared/useUserRole';
import { useProfile } from '@/hooks/shared/useProfile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

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
  { to: '/estoque', icon: Package, label: 'Estoque Central', permission: 'can_access_estoque' },
  { to: '/estoque-producao', icon: Boxes, label: 'Estoque Produção', permission: 'can_access_estoque_producao' },
  { to: '/fichas', icon: FileText, label: 'Fichas Técnicas', permission: 'can_access_fichas' },
  { to: '/producao', icon: Factory, label: 'Produções', permission: 'can_access_producao' },
  { to: '/previsao-vendas', icon: CalendarClock, label: 'Previsão Vendas', permission: 'can_access_producao' },
  { to: '/compras', icon: ShoppingCart, label: 'Compras', permission: 'can_access_compras' },
  { to: '/estoque-insumos-produzidos', icon: UtensilsCrossed, label: 'Insumos Produzidos', permission: 'can_access_estoque_producao' },
  { to: '/estoque-finalizados', icon: PackageCheck, label: 'Produções Finalizadas', permission: 'can_access_finalizados' },
  { to: '/perdas', icon: TrendingDown, label: 'Perdas', permission: 'can_access_estoque' },
  { to: '/praca-quente', icon: Zap, label: 'Praça Quente (PDV)', permission: 'can_access_produtos_venda' },
  { to: '/produtos-venda', icon: ShoppingBag, label: 'Produtos p/ Venda', permission: 'can_access_produtos_venda' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', permission: 'can_access_relatorios' },
  { to: '/financeiro', icon: Calculator, label: 'Financeiro', permission: 'can_access_financeiro' },
  { to: '/assinatura', icon: CreditCard, label: 'Assinatura', permission: null },
  { to: '/colaboradores', icon: UserCog, label: 'Colaboradores', permission: null, managementOnly: true },
  { to: '/cadastros', icon: ShieldCheck, label: 'Cadastros', permission: null, managementOnly: true },
  { to: '/admin', icon: Shield, label: 'Admin', permission: null, adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const { logout, user } = useAuth();
  const { collaborator, isCollaboratorMode, clearCollaboratorSession } = useCollaboratorContext();
  const { isAdmin, isGestor } = useUserRole();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleLogout = async () => {
    if (isCollaboratorMode) {
      clearCollaboratorSession();
    }
    queryClient.clear();
    await logout();
    // Use full page reload after a short delay to avoid React unmount issues
    setTimeout(() => {
      window.location.href = '/auth';
    }, 100);
  };

  const isOwner = (profile?.role as string) === 'owner';

  // Build visible nav items — memoized to avoid recalculating on every parent render
  const visibleNavItems = useMemo(() => navItems.filter((item: NavItem) => {
    // Owner and admin always see everything
    if (isOwner || isAdmin) return true;

    // Gestor sees everything except admin-only items
    if (isGestor) return !item.adminOnly;

    // While profile is loading, show only basic non-restricted items
    if (!profile) return !item.adminOnly && !item.managementOnly;

    // Admin-only items (e.g. Admin panel) require admin/owner role
    if (item.adminOnly) return false;
    // Management-only items (e.g. Cadastros, Colaboradores) require admin or gestor role
    if (item.managementOnly) return false;

    // Colaboradores only see what they explicitly have permission for
    if (profile.role === 'colaborador') {
      if (!item.permission) return item.to === '/dashboard'; // Always allow dashboard
      return (profile as any)[item.permission] === true;
    }

    // Fallback: regular user role sees standard (non-restricted) items
    return true;
  }), [isOwner, isAdmin, isGestor, profile]);
  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-sidebar text-sidebar-foreground h-screen fixed left-0 top-0 z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo Azura - Fixed at top */}
      <div
        className="p-3 border-b border-sidebar-border cursor-pointer hover:bg-sidebar-accent/50 transition-colors flex-shrink-0"
        onClick={() => router.push('/dashboard')}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              <div className="flex items-center gap-[2px]">
                <h1 className="font-bold text-xl leading-tight tracking-tight">Azura</h1>
                <div className="w-[5px] h-[5px] rounded-full bg-primary mt-1"></div>
              </div>
              <p className="text-[10px] text-sidebar-muted truncate" style={{ fontFamily: '"Outfit", sans-serif' }}>Gestão Gastronômica</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => (
          <NavigationLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "nav-item text-base py-3",
                isActive && "nav-item-active"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span className="animate-fade-in truncate" title={item.label}>{item.label}</span>}
          </NavigationLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-2 border-t border-sidebar-border flex-shrink-0">
        {!collapsed && (
          <div className="mb-2 px-3 animate-fade-in">
            {isCollaboratorMode && collaborator ? (
              <>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium truncate">{collaborator.name}</p>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">Colaborador</Badge>
                </div>
              </>
            ) : user ? (
              <>
                <p className="text-xs font-medium truncate">{user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário'}</p>
                <p className="text-[10px] text-sidebar-muted truncate">{user.email}</p>
              </>
            ) : null}
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="nav-item w-full text-destructive hover:bg-destructive/10 text-base py-3"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Theme Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute -right-3 top-2 h-5 w-5 rounded-full border bg-card shadow-md hover:bg-accent"
      >
        {theme === 'dark' ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
      </Button>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-14 h-5 w-5 rounded-full border bg-card shadow-md hover:bg-accent"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  );
}

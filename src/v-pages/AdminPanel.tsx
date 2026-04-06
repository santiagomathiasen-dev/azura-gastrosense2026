'use client';

import { useState, useMemo } from 'react';
import { useGestaoUsuarios, Gestor } from '@/hooks/useGestaoUsuarios';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Search, Users, ShieldAlert, Plus, Pencil, Trash2, Shield,
  Eye, EyeOff, CreditCard, CheckCircle2, XCircle,
  CalendarClock, Clock
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const permissionLabels: Record<string, string> = {
  can_access_dashboard: 'Painel',
  can_access_estoque: 'Estoque Central',
  can_access_estoque_producao: 'Estoque Producao',
  can_access_fichas: 'Fichas Tecnicas',
  can_access_producao: 'Producoes',
  can_access_compras: 'Compras',
  can_access_finalizados: 'Prod. Finalizadas',
  can_access_produtos_venda: 'Produtos p/ Venda',
  can_access_financeiro: 'Financeiro',
  can_access_relatorios: 'Relatorios',
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-500/15 text-purple-700 border-purple-500/30' },
  admin: { label: 'Admin', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  gestor: { label: 'Gestor', color: 'bg-green-500/15 text-green-700 border-green-500/30' },
  colaborador: { label: 'Colaborador', color: 'bg-orange-500/15 text-orange-700 border-orange-500/30' },
  user: { label: 'Usuario', color: 'bg-gray-500/15 text-gray-700 border-gray-500/30' },
};

export default function AdminPanel() {
  const { profiles, isLoading, createGestor, updatePermissions, updateStatus, updateSubscription, deleteGestor } = useGestaoUsuarios();
  const { setImpersonation } = useCollaboratorContext();
  const router = useRouter();
  const { profile: currentProfile, isLoading: profileLoading } = useProfile();
  const { isAdmin } = useUserRole();
  const { canCreate, limits } = usePlanLimits();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGestor, setEditingGestor] = useState<Gestor | null>(null);
  const [activeTab, setActiveTab] = useState('usuarios');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    can_access_dashboard: true,
    can_access_estoque: true,
    can_access_estoque_producao: true,
    can_access_fichas: true,
    can_access_producao: true,
    can_access_compras: true,
    can_access_finalizados: true,
    can_access_produtos_venda: true,
    can_access_financeiro: true,
    can_access_relatorios: true,
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return profiles.filter(p => {
      const pName = p.full_name || '';
      const pEmail = p.email || '';
      return pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pEmail.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [profiles, searchTerm]);

  // Stats
  const totalUsers = profiles.length;
  const totalGestores = profiles.filter(p => p.role === 'gestor').length;
  const totalColabs = profiles.filter(p => p.role === 'colaborador').length;
  const totalPaid = profiles.filter(p => p.status_pagamento).length;
  const totalActive = profiles.filter(p => p.status === 'ativo').length;

  const isOwnerRole = (currentProfile?.role as string) === 'owner' || (currentProfile?.role as string) === 'admin';

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwnerRole && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas administradores podem acessar este painel.</p>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditingGestor(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPermissions({
      can_access_dashboard: true,
      can_access_estoque: true,
      can_access_estoque_producao: true,
      can_access_fichas: true,
      can_access_producao: true,
      can_access_compras: true,
      can_access_finalizados: true,
      can_access_produtos_venda: true,
      can_access_financeiro: true,
      can_access_relatorios: true,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (gestor: Gestor) => {
    setEditingGestor(gestor);
    setPermissions({
      can_access_dashboard: gestor.can_access_dashboard,
      can_access_estoque: gestor.can_access_estoque,
      can_access_estoque_producao: gestor.can_access_estoque_producao,
      can_access_fichas: gestor.can_access_fichas,
      can_access_producao: gestor.can_access_producao,
      can_access_compras: gestor.can_access_compras,
      can_access_finalizados: gestor.can_access_finalizados,
      can_access_produtos_venda: gestor.can_access_produtos_venda,
      can_access_financeiro: gestor.can_access_financeiro,
      can_access_relatorios: gestor.can_access_relatorios,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGestor) {
      await updatePermissions.mutateAsync({ gestorId: editingGestor.id, permissions });
    } else {
      if (password.trim() !== confirmPassword.trim()) {
        toast.error('As senhas nao coincidem!');
        return;
      }
      await createGestor.mutateAsync({ name, email, password, permissions });
    }
    setDialogOpen(false);
  };

  const handleGrantAccess = (userId: string, days: number, plan?: string) => {
    updateSubscription.mutate({ id: userId, days, plan });
  };

  const handleRevokeAccess = (userId: string) => {
    updateSubscription.mutate({ id: userId, days: 0 });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Administrativo"
        description="Gerencie todos os usuarios e assinaturas do sistema"
        action={{
          label: 'Novo Gestor',
          onClick: handleOpenCreate,
          icon: Plus,
        }}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-600">{totalGestores}</p>
            <p className="text-xs text-muted-foreground">Gestores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{totalColabs}</p>
            <p className="text-xs text-muted-foreground">Colaboradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalPaid}</p>
            <p className="text-xs text-muted-foreground">Pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalActive}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Todos os Usuarios
          </TabsTrigger>
          <TabsTrigger value="assinaturas" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Assinaturas
          </TabsTrigger>
        </TabsList>

        {/* Search */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* ===== TAB: TODOS OS USUARIOS ===== */}
        <TabsContent value="usuarios" className="mt-4">
          {/* Create/Edit Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGestor ? 'Permissoes' : 'Novo Gestor'}</DialogTitle>
                <DialogDescription>
                  {editingGestor ? `Ajuste as permissoes de ${editingGestor.full_name}.` : 'Crie uma nova conta de gestor.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingGestor && (
                  <>
                    <div className="space-y-2">
                      <Label>Nome Completo</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <div className="relative">
                        <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha</Label>
                      <div className="relative">
                        <Input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pr-10" />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Permissoes de Abas
                  </Label>
                  <div className="grid gap-2 p-3 bg-muted/50 rounded-lg">
                    {Object.keys(permissionLabels).map((key) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm">{permissionLabels[key]}</span>
                        <Switch
                          checked={permissions[key]}
                          onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, [key]: checked }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createGestor.isPending || updatePermissions.isPending}>
                  {editingGestor ? 'Salvar Permissoes' : 'Criar Gestor'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <div className="grid gap-3">
            {filteredUsers.map((user) => {
              const role = ROLE_LABELS[user.role] || ROLE_LABELS.user;
              const isPaid = user.status_pagamento === true;
              const isActive = user.status === 'ativo';
              const endDate = user.subscription_end_date
                ? new Date(user.subscription_end_date).toLocaleDateString('pt-BR')
                : null;

              return (
                <Card key={user.id} className={!isActive ? 'opacity-60' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{user.full_name || 'Sem nome'}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${role.color}`}>
                            {role.label}
                          </span>
                          {isPaid && (
                            <Badge variant="default" className="text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                            </Badge>
                          )}
                          {!isActive && (
                            <Badge variant="destructive" className="text-[10px]">Inativo</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span>Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                          {endDate && <span>Expira: {endDate}</span>}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Active/Inactive toggle */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{isActive ? 'Ativo' : 'Inativo'}</span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => updateStatus.mutate({ id: user.id, status: checked ? 'ativo' : 'inativo' })}
                          />
                        </div>

                        <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleOpenEdit(user)}>
                          <Pencil className="h-3 w-3 mr-1" /> Permissoes
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => {
                            setImpersonation(user.id);
                            toast.success(`Visualizando como ${user.full_name}`);
                            router.push('/dashboard');
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Ver
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive h-8">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso removera {user.full_name || user.email} e todos os dados associados. Essa acao nao pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteGestor.mutate(user.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum usuario encontrado.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== TAB: ASSINATURAS ===== */}
        <TabsContent value="assinaturas" className="mt-4">
          <div className="grid gap-3">
            {filteredUsers.map((user) => {
              const isPaid = user.status_pagamento === true;
              const role = ROLE_LABELS[user.role] || ROLE_LABELS.user;

              return (
                <Card key={user.id} className={!isPaid ? 'border-destructive/30' : 'border-green-500/30'}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{user.full_name || 'Sem nome'}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${role.color}`}>
                            {role.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>

                      <Badge variant={isPaid ? 'default' : 'destructive'} className="shrink-0">
                        {isPaid ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Bloqueado</>
                        )}
                      </Badge>

                      <Switch
                        checked={isPaid}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleGrantAccess(user.id, 30, 'pro');
                          } else {
                            handleRevokeAccess(user.id);
                          }
                        }}
                        disabled={updateSubscription.isPending}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum usuario encontrado.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

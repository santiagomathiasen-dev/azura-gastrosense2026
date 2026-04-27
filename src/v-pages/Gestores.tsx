import { useState, useMemo } from 'react';
import { useGestaoUsuarios, Gestor } from '@/hooks/shared/useGestaoUsuarios';
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
import { Loader2, Search, Users, ShieldAlert, Plus, Pencil, Trash2, Shield, Eye, EyeOff, CreditCard, CalendarClock, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useProfile } from '@/hooks/shared/useProfile';
import { useUserRole } from '@/hooks/shared/useUserRole';
import { usePlanLimits } from '@/hooks/shared/usePlanLimits';
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

function getSubscriptionStatus(gestor: Gestor): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle2 } {
  if (!gestor.status_pagamento) {
    // Check if still in trial
    if (gestor.created_at) {
      const created = new Date(gestor.created_at);
      const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) {
        const remaining = Math.ceil(7 - diffDays);
        return { label: `Trial (${remaining}d)`, variant: 'secondary', icon: Clock };
      }
    }
    return { label: 'Sem Assinatura', variant: 'destructive', icon: XCircle };
  }

  if (gestor.subscription_end_date) {
    const end = new Date(gestor.subscription_end_date);
    const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) {
      return { label: 'Expirada', variant: 'destructive', icon: XCircle };
    }
    if (daysLeft <= 3) {
      return { label: `Expira em ${daysLeft}d`, variant: 'outline', icon: CalendarClock };
    }
    return { label: `Ativo (${daysLeft}d)`, variant: 'default', icon: CheckCircle2 };
  }

  return { label: 'Ativo', variant: 'default', icon: CheckCircle2 };
}

export default function Gestores() {
  const { profiles, isLoading, createGestor, updatePermissions, updateStatus, updateSubscription, deleteGestor } = useGestaoUsuarios();
  const { setImpersonation } = useCollaboratorContext();
  const router = useRouter();
  const navigate = (p: string) => router.push(p);
  const { profile: currentProfile, isLoading: profileLoading } = useProfile();
  const { isAdmin } = useUserRole();
  const { canCreate, limits } = usePlanLimits();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGestor, setEditingGestor] = useState<Gestor | null>(null);
  const [activeTab, setActiveTab] = useState('gestores');

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

  const allUsers = useMemo(() => {
    return profiles.filter(p => {
      const pName = p.full_name || '';
      const pEmail = p.email || '';
      return pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pEmail.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [profiles, searchTerm]);

  const filteredGestors = useMemo(() => allUsers.filter(p => p.role === 'gestor'), [allUsers]);
  const allSubscribableUsers = allUsers;

  const isOwnerRole = (currentProfile?.role as string) === 'owner' || (currentProfile?.role as string) === 'admin';
  const hasAccessAccess = isAdmin || isOwnerRole || (!currentProfile && !profileLoading);

  const totalGestores = profiles.filter(p => p.role === 'gestor').length;

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccessAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas o administrador principal pode gerenciar gestores.</p>
      </div>
    );
  }

  const handleOpenCreate = () => {
    if (!canCreate('gestores', totalGestores)) {
      toast.error(`Limite de gestores alcancado (${limits.gestores}). Faca upgrade do seu plano.`);
      return;
    }
    setEditingGestor(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
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
        title="Gestao de Gestores"
        description={`Controle gestores e assinaturas (${totalGestores}/${limits.gestores === Infinity ? '\u221E' : limits.gestores})`}
        action={{
          label: 'Novo Gestor',
          onClick: handleOpenCreate,
          icon: Plus,
          disabled: !canCreate('gestores', totalGestores)
        }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gestores" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gestores
          </TabsTrigger>
          <TabsTrigger value="assinaturas" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Assinaturas
          </TabsTrigger>
        </TabsList>

        {/* Search bar - shared */}
        <div className="flex items-center gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* ===== TAB: GESTORES ===== */}
        <TabsContent value="gestores" className="mt-4">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingGestor ? 'Permissoes do Gestor' : 'Novo Gestor'}</DialogTitle>
                <DialogDescription>
                  {editingGestor ? `Ajuste o que ${editingGestor.full_name} pode acessar.` : 'Crie uma nova conta de gestor.'}
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGestors.map((gestor) => {
              const subStatus = getSubscriptionStatus(gestor);
              return (
                <Card key={gestor.id} className={gestor.status !== 'ativo' ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{gestor.full_name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{gestor.email}</p>
                      </div>
                      <Switch
                        checked={gestor.status === 'ativo'}
                        onCheckedChange={(checked) => updateStatus.mutate({ id: gestor.id, status: checked ? 'ativo' : 'inativo' })}
                      />
                    </div>
                    <Badge variant={subStatus.variant} className="w-fit text-[10px] mt-1">
                      <subStatus.icon className="h-3 w-3 mr-1" />
                      {subStatus.label}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(permissionLabels).map(key => gestor[key as keyof Gestor] && (
                        <Badge key={key} variant="secondary" className="text-[10px]">
                          {permissionLabels[key]}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEdit(gestor)}>
                        <Pencil className="h-3 w-3 mr-1" /> Permissoes
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setImpersonation(gestor.id);
                          toast.success(`Visualizando como ${gestor.full_name}`);
                          navigate('/dashboard');
                        }}
                      >
                        <Users className="h-3 w-3 mr-1" /> Ver Dados
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Gestor?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Isso removera a conta e todos os dados associados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteGestor.mutate(gestor.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== TAB: ASSINATURAS ===== */}
        <TabsContent value="assinaturas" className="mt-4">
          <div className="grid gap-3">
            {allSubscribableUsers.map((user) => {
              const isPaid = user.status_pagamento === true;

              return (
                <Card key={user.id} className={!isPaid ? 'border-destructive/30' : 'border-green-500/30'}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      {/* User info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{user.full_name || 'Sem nome'}</p>
                          <Badge variant="outline" className="text-[9px] shrink-0">
                            {(user.role as string) === 'owner' ? 'Owner' : user.role === 'admin' ? 'Admin' : user.role === 'colaborador' ? 'Colab.' : 'Gestor'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>

                      {/* Status badge */}
                      <Badge variant={isPaid ? 'default' : 'destructive'} className="shrink-0">
                        {isPaid ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Pago</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Bloqueado</>
                        )}
                      </Badge>

                      {/* Toggle */}
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

            {allSubscribableUsers.length === 0 && (
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

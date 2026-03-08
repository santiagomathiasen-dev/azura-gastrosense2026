import { useState, useMemo } from 'react';
import { useGestaoUsuarios, Gestor } from '@/hooks/useGestaoUsuarios';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Users, ShieldAlert, Plus, Pencil, Trash2, KeyRound, Shield, Eye, EyeOff } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useUserRole } from '@/hooks/useUserRole';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const permissionLabels: Record<string, string> = {
  can_access_dashboard: 'Painel',
  can_access_estoque: 'Estoque Central',
  can_access_estoque_producao: 'Estoque Produção',
  can_access_fichas: 'Fichas Técnicas',
  can_access_producao: 'Produções',
  can_access_compras: 'Compras',
  can_access_finalizados: 'Prod. Finalizadas',
  can_access_produtos_venda: 'Produtos p/ Venda',
  can_access_financeiro: 'Financeiro',
  can_access_relatorios: 'Relatórios',
};

export default function Gestores() {
  const { profiles, isLoading, createGestor, updatePermissions, updateStatus, deleteGestor } = useGestaoUsuarios();
  const { setImpersonation } = useCollaboratorContext();
  const router = useRouter();
  const navigate = (p: string) => router.push(p);
  const { profile: currentProfile, isLoading: profileLoading } = useProfile();
  const { isAdmin } = useUserRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGestor, setEditingGestor] = useState<Gestor | null>(null);

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

  const filteredGestors = useMemo(() => {
    return profiles.filter(p => p.role === 'gestor').filter(p => {
      const pName = p.full_name || '';
      const pEmail = p.email || '';
      return pName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pEmail.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [profiles, searchTerm]);

  // Allows: the main admin email, users with role 'admin' or 'owner'
  const isSantiago = currentProfile?.email === 'santiago.aloom@gmail.com';
  const isOwnerRole = (currentProfile?.role as string) === 'owner' || (currentProfile?.role as string) === 'admin';
  // Allow access if admin, santiago, owner, OR if we are in development/bypass mode (no profile yet)
  const hasAccess = isSantiago || isAdmin || isOwnerRole || (!currentProfile && !profileLoading);

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p className="text-muted-foreground">Apenas o administrador principal pode gerenciar gestores.</p>
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
        toast.error('As senhas não coincidem!');
        return;
      }
      await createGestor.mutateAsync({ name, email, password, permissions });
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Gestores"
        description="Controle quem são os administradores de unidades e suas permissões"
        action={{
          label: 'Novo Gestor',
          onClick: handleOpenCreate,
          icon: Plus,
        }}
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gestor..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGestor ? 'Permissões do Gestor' : 'Novo Gestor'}</DialogTitle>
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
                Permissões de Abas
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
              {editingGestor ? 'Salvar Permissões' : 'Criar Gestor'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredGestors.map((gestor) => (
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
                  <Pencil className="h-3 w-3 mr-1" /> Permissões
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
                        Isso removerá a conta e todos os dados associados.
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
        ))}
      </div>
    </div>
  );
}

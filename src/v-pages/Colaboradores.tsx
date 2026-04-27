import { useState } from 'react';
import { useCollaborators, Collaborator, CollaboratorPermissions } from '@/hooks/shared/useCollaborators';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, KeyRound, Users, Shield, Eye, EyeOff } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { usePlanLimits } from '@/hooks/shared/usePlanLimits';
import { toast } from 'sonner';

const defaultPermissions: CollaboratorPermissions = {
  can_access_dashboard: true,
  can_access_estoque: false,
  can_access_estoque_producao: false,
  can_access_fichas: false,
  can_access_producao: false,
  can_access_compras: false,
  can_access_finalizados: false,
  can_access_produtos_venda: false,
  can_access_financeiro: false,
  can_access_relatorios: false,
};

const permissionLabels: Record<keyof CollaboratorPermissions, string> = {
  can_access_dashboard: 'Dashboard',
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

export default function Colaboradores() {
  const { collaborators, isLoading, createCollaborator, updateCollaborator, deleteCollaborator, toggleActive } = useCollaborators();
  const { canCreate, limits } = usePlanLimits();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(defaultPermissions);

  const handleOpenCreate = () => {
    if (!canCreate('colaboradores', collaborators.length)) {
      toast.error(`Limite de colaboradores alcançado (${limits.colaboradores}). Faça upgrade do seu plano.`);
      return;
    }
    setEditingCollaborator(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPin('');
    setConfirmPin('');
    setPinError('');
    setPermissions(defaultPermissions);
    setDialogOpen(true);
  };

  const handleOpenEdit = (collab: Collaborator) => {
    setEditingCollaborator(collab);
    setName(collab.name);
    setEmail(collab.email || '');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPin('');
    setConfirmPin('');
    setPinError('');
    setPermissions({
      can_access_dashboard: collab.can_access_dashboard,
      can_access_estoque: collab.can_access_estoque,
      can_access_estoque_producao: collab.can_access_estoque_producao,
      can_access_fichas: collab.can_access_fichas,
      can_access_producao: collab.can_access_producao,
      can_access_compras: collab.can_access_compras,
      can_access_finalizados: collab.can_access_finalizados,
      can_access_produtos_venda: collab.can_access_produtos_venda,
      can_access_financeiro: collab.can_access_financeiro,
      can_access_relatorios: collab.can_access_relatorios,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // For new collaborators, email and password are required along with PIN
    if (!editingCollaborator) {
      if (!canCreate('colaboradores', collaborators.length)) {
        toast.error(`Limite de colaboradores alcançado (${limits.colaboradores}). Faça upgrade do seu plano.`);
        return;
      }
      if (!email.trim() || !password.trim()) {
        toast.error('Email e senha são obrigatórios');
        return;
      }
      if (password.trim() !== confirmPassword.trim()) {
        toast.error('As senhas não coincidem!');
        return;
      }
      if (pin.length > 0 && pin.length !== 6) {
        setPinError('PIN deve ter 6 dígitos');
        return;
      }
      if (pin.trim().length > 0 && pin.trim() !== confirmPin.trim()) {
        setPinError('Os PINs não coincidem');
        return;
      }
      await createCollaborator.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        pin: pin || undefined,
        permissions
      });
    } else {
      // For editing, PIN is optional (only update if provided)
      if (pin.length > 0 && pin.length !== 6) {
        setPinError('PIN deve ter 6 dígitos');
        return;
      }
      if (pin.trim().length > 0 && pin.trim() !== confirmPin.trim()) {
        setPinError('Os PINs não coincidem');
        return;
      }
      await updateCollaborator.mutateAsync({
        id: editingCollaborator.id,
        name: name.trim(),
        pin: pin.length === 6 ? pin : undefined,
        permissions
      });
    }
    setDialogOpen(false);
  };

  const togglePermission = (key: keyof CollaboratorPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Colaboradores"
        description={`Gerencie quem opera seu sistema (${collaborators.length}/${limits.colaboradores === Infinity ? '∞' : limits.colaboradores})`}
        action={{
          label: 'Novo Colaborador',
          onClick: handleOpenCreate,
          icon: Plus,
          disabled: !canCreate('colaboradores', collaborators.length)
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCollaborator ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
            <DialogDescription>
              {editingCollaborator
                ? 'Atualize os dados e permissões. Deixe o PIN vazio para manter o atual.'
                : 'Preencha os dados do colaborador. O PIN será usado para login.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Colaborador</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                  disabled={!!editingCollaborator}
                />
              </div>

              {!editingCollaborator && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha Temporária</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                {editingCollaborator ? 'Novo PIN (opcional)' : 'PIN de Acesso'}
              </Label>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {editingCollaborator ? 'Novo PIN (6 dígitos)' : 'PIN (6 dígitos)'}
                  </Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={pin}
                      onChange={(value) => {
                        setPin(value.replace(/[^0-9]/g, ''));
                        setPinError('');
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Confirmar PIN</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={confirmPin}
                      onChange={(value) => {
                        setConfirmPin(value.replace(/[^0-9]/g, ''));
                        setPinError('');
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                {pinError && (
                  <p className="text-xs text-destructive text-center">{pinError}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões de Acesso
              </Label>
              <div className="grid gap-2 p-3 bg-muted/50 rounded-lg">
                {(Object.keys(permissionLabels) as Array<keyof CollaboratorPermissions>).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{permissionLabels[key]}</span>
                    <Switch
                      checked={permissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={createCollaborator.isPending || updateCollaborator.isPending}>
                {editingCollaborator ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {collaborators.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum colaborador"
          description="Adicione colaboradores para que possam acessar o sistema com permissões específicas"
          action={{
            label: 'Novo Colaborador',
            onClick: handleOpenCreate,
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collaborators.map((collab) => (
            <Card key={collab.id} className={!collab.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{collab.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{collab.email}</p>
                    <div className="flex gap-1.5">
                      {!collab.is_active && (
                        <Badge variant="destructive" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={collab.is_active}
                    onCheckedChange={(checked) => toggleActive.mutate({ id: collab.id, isActive: checked })}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(permissionLabels) as Array<keyof CollaboratorPermissions>).map((key) =>
                    collab[key] && (
                      <Badge key={key} variant="outline" className="text-xs font-normal">
                        {permissionLabels[key]}
                      </Badge>
                    )
                  )}
                </div>

                <div className="flex gap-1.5 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(collab)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover colaborador?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O colaborador "{collab.name}" será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCollaborator.mutate(collab.id)}>
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

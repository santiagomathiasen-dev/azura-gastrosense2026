import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    Link,
    Store,
    Plus,
    RefreshCw,
    Trash2,
    Settings2,
    ExternalLink,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { usePosIntegrations, PosIntegration } from '@/hooks/usePosIntegrations';
import { format } from 'date-fns';

export default function ConfiguracaoPDV() {
    const { integrations, isLoading, createIntegration, updateIntegration, deleteIntegration, syncIntegration } = usePosIntegrations();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    
    const [newIntegration, setNewIntegration] = useState({
        platform: '',
        name: '',
        token: '',
        clientId: '',
        clientSecret: ''
    });

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'loyverse':
                return <Store className="h-6 w-6 text-green-600" />;
            case 'ifood':
                return <img src="https://logodownload.org/wp-content/uploads/2017/05/ifood-logo-0.png" alt="iFood" className="w-8 h-8 object-contain" />;
            case 'hubster':
                return <Store className="h-6 w-6 text-blue-600" />;
            default:
                return <Settings2 className="h-6 w-6 text-muted-foreground" />;
        }
    };

    const getPlatformName = (platform: string) => {
        const names: Record<string, string> = {
            loyverse: 'Loyverse POS',
            ifood: 'iFood / Portal do Parceiro',
            hubster: 'Hubster (Otter)',
            custom: 'Personalizado API'
        };
        return names[platform] || platform;
    };

    const handleConnect = () => {
        let credentials = {};
        if (newIntegration.platform === 'loyverse') {
            if (!newIntegration.token) return toast.error('Token é obrigatório!');
            credentials = { access_token: newIntegration.token };
        } else if (newIntegration.platform === 'ifood') {
            if (!newIntegration.clientId || !newIntegration.clientSecret) return toast.error('Credenciais obrigatórias!');
            credentials = { client_id: newIntegration.clientId, client_secret: newIntegration.clientSecret };
        }
        
        createIntegration.mutate({
            platform: newIntegration.platform,
            name: newIntegration.name || getPlatformName(newIntegration.platform),
            credentials
        }, {
            onSuccess: () => {
                setIsAddDialogOpen(false);
                setNewIntegration({ platform: '', name: '', token: '', clientId: '', clientSecret: '' });
            }
        });
    };

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            <PageHeader
                title="Integrações PDV"
                description="Conecte seu catálogo a plataformas de vendas e PDVs externos para sincronização automática"
                action={{
                    label: 'Adicionar PDV',
                    onClick: () => setIsAddDialogOpen(true),
                    icon: Plus
                }}
            />

            {integrations.length === 0 ? (
                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                            <Link className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Nenhum PDV conectado</h3>
                        <p className="text-muted-foreground max-w-md mb-6">
                            Você pode conectar o Azura a sistemas como Loyverse, iFood ou Hubster para dar baixa automática no seu estoque de Fichas Técnicas sempre que uma venda acontecer.
                        </p>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Primeira Conexão
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {integrations.map((integration) => (
                        <Card key={integration.id} className={integration.status === 'connected' ? "border-emerald-200" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${integration.platform === 'ifood' ? 'bg-red-100' : 'bg-green-100'}`}>
                                        {getPlatformIcon(integration.platform)}
                                    </div>
                                    <div className="min-w-0">
                                        <CardTitle className="text-base truncate">{integration.name}</CardTitle>
                                        <CardDescription className="text-xs truncate">{getPlatformName(integration.platform)}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge variant={integration.status === 'connected' ? "default" : "destructive"} className={integration.status === 'connected' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : ""}>
                                        {integration.status === 'connected' ? "Online" : "Desconectado"}
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Última Sincronização</span>
                                    <span className="font-medium">
                                        {integration.last_sync_at ? format(new Date(integration.last_sync_at), 'dd/MM/yyyy HH:mm') : 'Nunca sincronizado'}
                                    </span>
                                </div>
                                {integration.platform === 'loyverse' && (
                                    <div className="pt-2 border-t space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium">Webhook URL (Copiar)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                readOnly
                                                value={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/loyverse-webhook`}
                                                className="h-8 text-xs bg-muted"
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-2"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/loyverse-webhook`);
                                                    toast.success("Webhook URL copiada!");
                                                }}
                                            >
                                                Copiar
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-tight">
                                            Cole esta URL nas configurações de Webhooks do Loyverse para receber as vendas em tempo real.
                                        </p>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full text-xs"
                                        onClick={() => syncIntegration.mutate(integration.id)}
                                        disabled={syncIntegration.isPending}
                                    >
                                        <RefreshCw className={`mr-2 h-3 w-3 ${syncIntegration.isPending && syncIntegration.variables === integration.id ? 'animate-spin' : ''}`} />
                                        Sincronizar
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                            if (window.confirm('Tem certeza que deseja desconectar e remover este PDV?')) {
                                                deleteIntegration.mutate(integration.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-3 w-3" />
                                        Desconectar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Conectar Novo Sistema PDV</DialogTitle>
                        <DialogDescription>
                            Sincronize vendas e catálogo automaticamente com plataformas externas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Sistema / Plataforma</Label>
                            <Select 
                                value={newIntegration.platform} 
                                onValueChange={(val) => setNewIntegration({...newIntegration, platform: val, name: getPlatformName(val)})}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o provedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="loyverse">Loyverse POS (API Token)</SelectItem>
                                    <SelectItem value="ifood">iFood Delivery</SelectItem>
                                    <SelectItem value="hubster">Hubster / Otter</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {newIntegration.platform && (
                            <div className="space-y-2">
                                <Label>Nome de Exibição (Opcional)</Label>
                                <Input 
                                    value={newIntegration.name} 
                                    onChange={(e) => setNewIntegration({...newIntegration, name: e.target.value})}
                                    placeholder="Ex: Loyverse Lojas Matriz" 
                                />
                            </div>
                        )}

                        {newIntegration.platform === 'loyverse' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <Accordion type="single" collapsible className="w-full border rounded-lg bg-muted/20 px-4">
                                    <AccordionItem value="passo-a-passo" className="border-none">
                                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                                            📖 Como obter o Token no Loyverse? (Passo a Passo)
                                        </AccordionTrigger>
                                        <AccordionContent className="text-sm text-muted-foreground space-y-2 pb-4">
                                            <p>1. Faça login no seu <a href="https://r.loyverse.com/dashboard/#/settings/tokens" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">Backoffice do Loyverse <ExternalLink className="h-3 w-3"/></a>.</p>
                                            <p>2. No menu esquerdo, vá em <strong>Configurações</strong> e depois em <strong>Tokens de Acesso</strong>.</p>
                                            <p>3. Clique no botão verde <strong>+ Adicionar token de acesso</strong>.</p>
                                            <p>4. Dê um nome (Ex: <em>Integração Azura</em>) e salve.</p>
                                            <p>5. Copie o longo código gerado e cole no campo abaixo.</p>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                <div className="space-y-2">
                                    <Label>Token de Acesso (Access Token)</Label>
                                    <Input 
                                        type="password"
                                        placeholder="eyX..." 
                                        value={newIntegration.token}
                                        onChange={(e) => setNewIntegration({...newIntegration, token: e.target.value})}
                                    />
                                    <p className="text-[10px] text-muted-foreground">Mantenha sua chave segura. Não compartilhe com ninguém além da integração Gastrosense.</p>
                                </div>
                            </div>
                        )}

                        {newIntegration.platform === 'ifood' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="space-y-2">
                                    <Label>Client ID</Label>
                                    <Input 
                                        placeholder="Client ID do Portal iFood" 
                                        value={newIntegration.clientId}
                                        onChange={(e) => setNewIntegration({...newIntegration, clientId: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Secret</Label>
                                    <Input 
                                        type="password"
                                        placeholder="••••••••••••••••" 
                                        value={newIntegration.clientSecret}
                                        onChange={(e) => setNewIntegration({...newIntegration, clientSecret: e.target.value})}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        As credenciais são obtidas no site do Portal do Parceiro iFood &gt; Aplicativos.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {newIntegration.platform === 'hubster' && (
                            <div className="bg-orange-50 text-orange-800 p-4 rounded-lg flex gap-3 text-sm">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p>Para conectar ao Hubster, precisamos gerar um link de parceiro. Recomendamos entrar em contato com o suporte do Azura Gastrosense para liberar a sua chave privada do Hubster Delivery.</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                        <Button 
                            onClick={handleConnect} 
                            disabled={!newIntegration.platform || newIntegration.platform === 'hubster' || createIntegration.isPending}
                        >
                            {createIntegration.isPending ? 'Conectando...' : 'Autenticar e Conectar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

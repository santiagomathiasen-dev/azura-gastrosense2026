import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Link,
    Store,
    Plus,
    RefreshCw,
    Trash2,
    Settings2,
    ExternalLink,
    AlertCircle,
    Copy,
    CheckCircle2,
    Zap,
    Globe,
    Code2,
    Webhook,
    Key,
    ArrowRight,
    Info,
    Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePosIntegrations, PosIntegration } from '@/hooks/usePosIntegrations';
import { formatInBrasilia } from '@/lib/utils';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/loyverse-webhook`;
const GENERIC_API_URL = `${SUPABASE_URL}/functions/v1/pos-integration`;

const PLATFORMS = [
    { value: 'loyverse', label: 'Loyverse POS', color: 'green', description: 'API token + webhook em tempo real' },
    { value: 'ifood', label: 'iFood Delivery', color: 'red', description: 'Client ID + Secret OAuth2' },
    { value: 'hubster', label: 'Hubster / Otter', color: 'blue', description: 'Parceiro via suporte Azura' },
    { value: 'custom', label: 'Qualquer PDV (API Genérica)', color: 'purple', description: 'Integre qualquer sistema via API Key' },
];

function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Copiado!');
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <Button size="sm" variant="outline" className="h-8 px-3 shrink-0" onClick={handleCopy}>
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1.5 text-xs">{copied ? 'Copiado' : label}</span>
        </Button>
    );
}

function StepBadge({ n }: { n: number }) {
    return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
            {n}
        </span>
    );
}

function LoyverseGuide() {
    return (
        <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold mb-1"><Zap className="h-4 w-4" /> Como funciona</div>
                <p>Cada venda no Loyverse dispara automaticamente um webhook para o Azura, que dá baixa no estoque das fichas técnicas em tempo real. Você também pode sincronizar manualmente a qualquer momento.</p>
            </div>

            <p className="text-sm font-semibold text-foreground">Passo a passo — obter o Token de Acesso:</p>
            <ol className="space-y-3">
                {[
                    <>Acesse o <a href="https://r.loyverse.com/dashboard/#/settings/tokens" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">Backoffice do Loyverse <ExternalLink className="h-3 w-3" /></a> e faça login.</>,
                    <>No menu esquerdo vá em <strong>Configurações</strong> → <strong>Tokens de Acesso</strong>.</>,
                    <>Clique em <strong>+ Adicionar token de acesso</strong>, dê o nome <em>Integração Azura</em> e salve.</>,
                    <>Copie o código gerado e cole no campo <strong>Token de Acesso</strong> abaixo.</>,
                    <>Após conectar, copie a <strong>Webhook URL</strong> exibida no card e registre-a no Loyverse em <strong>Configurações → Webhooks</strong>.</>,
                ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <StepBadge n={i + 1} />
                        <span>{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function IFoodGuide() {
    return (
        <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
                <div className="flex items-center gap-2 font-semibold mb-1"><Info className="h-4 w-4" /> Pré-requisito</div>
                <p>Você precisa ter acesso ao <strong>Portal do Parceiro iFood</strong> como Merchant Owner ou Admin para gerar credenciais de API.</p>
            </div>
            <p className="text-sm font-semibold text-foreground">Passo a passo — obter Client ID e Secret:</p>
            <ol className="space-y-3">
                {[
                    <>Acesse o <a href="https://portal.ifood.com.br" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">Portal do Parceiro iFood <ExternalLink className="h-3 w-3" /></a>.</>,
                    <>No menu lateral clique em <strong>Integrações</strong> → <strong>Aplicativos</strong>.</>,
                    <>Clique em <strong>Criar Aplicativo</strong>, dê o nome <em>Azura Gastrosense</em> e confirme.</>,
                    <>Copie o <strong>Client ID</strong> e <strong>Client Secret</strong> gerados e cole nos campos abaixo.</>,
                    <>Após conectar, a sincronização de pedidos ocorrerá automaticamente a cada ciclo.</>,
                ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <StepBadge n={i + 1} />
                        <span>{step}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function CustomGuide({ apiKey }: { apiKey?: string }) {
    const exampleCurl = `curl -X POST "${GENERIC_API_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey ?? 'SUA_API_KEY'}" \\
  -d '{
    "sold_items": [
      { "product_id": "uuid-do-produto", "quantity": 2 },
      { "product_id": "uuid-do-produto-2", "quantity": 1 }
    ]
  }'`;

    const exampleGetProducts = `curl -X GET "${GENERIC_API_URL}" \\
  -H "x-api-key: ${apiKey ?? 'SUA_API_KEY'}"`;

    return (
        <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800">
                <div className="flex items-center gap-2 font-semibold mb-1"><Globe className="h-4 w-4" /> API Universal</div>
                <p>Use esta integração para conectar <strong>qualquer PDV</strong> (Totvs, Linx, Micros, sistemas próprios, etc.) ao Azura via uma API REST simples com autenticação por chave.</p>
            </div>

            <p className="text-sm font-semibold text-foreground">Como integrar qualquer PDV:</p>
            <ol className="space-y-3">
                {[
                    <>Clique em <strong>Autenticar e Conectar</strong> para gerar sua API Key exclusiva.</>,
                    <>Configure seu PDV para chamar o endpoint abaixo a cada venda realizada.</>,
                    <>Use o endpoint GET para buscar a lista de produtos cadastrados no Azura.</>,
                    <>A API dá baixa automática no estoque e fichas técnicas a cada chamada.</>,
                ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <StepBadge n={i + 1} />
                        <span>{step}</span>
                    </li>
                ))}
            </ol>

            {apiKey && (
                <div className="space-y-3 pt-2">
                    <p className="text-sm font-semibold">Endpoints disponíveis:</p>

                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Code2 className="h-3 w-3" /> GET — Buscar produtos cadastrados</p>
                        <div className="flex items-center gap-2 bg-muted rounded p-2">
                            <code className="text-xs flex-1 break-all">{GENERIC_API_URL}</code>
                            <CopyButton value={GENERIC_API_URL} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Code2 className="h-3 w-3" /> POST — Registrar venda</p>
                        <div className="flex items-center gap-2 bg-muted rounded p-2">
                            <code className="text-xs flex-1 break-all">{GENERIC_API_URL}</code>
                            <CopyButton value={GENERIC_API_URL} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Key className="h-3 w-3" /> Header de autenticação</p>
                        <div className="flex items-center gap-2 bg-muted rounded p-2">
                            <code className="text-xs flex-1 break-all">x-api-key: {apiKey}</code>
                            <CopyButton value={apiKey} />
                        </div>
                    </div>

                    <Tabs defaultValue="post" className="w-full">
                        <TabsList className="h-7 text-xs">
                            <TabsTrigger value="post" className="text-xs h-6">Exemplo POST</TabsTrigger>
                            <TabsTrigger value="get" className="text-xs h-6">Exemplo GET</TabsTrigger>
                        </TabsList>
                        <TabsContent value="post">
                            <div className="relative bg-zinc-900 rounded-lg p-3">
                                <pre className="text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap">{exampleCurl}</pre>
                                <div className="absolute top-2 right-2">
                                    <CopyButton value={exampleCurl} />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="get">
                            <div className="relative bg-zinc-900 rounded-lg p-3">
                                <pre className="text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap">{exampleGetProducts}</pre>
                                <div className="absolute top-2 right-2">
                                    <CopyButton value={exampleGetProducts} />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                        <strong>Body do POST (sold_items):</strong> array de objetos com <code>product_id</code> (UUID do produto no Azura) e <code>quantity</code>. Use o endpoint GET para listar todos os IDs dos seus produtos.
                    </div>
                </div>
            )}
        </div>
    );
}

function IntegrationCard({ integration, onSync, onDelete, isSyncing }: {
    integration: PosIntegration;
    onSync: () => void;
    onDelete: () => void;
    isSyncing: boolean;
}) {
    const isCustom = integration.platform === 'custom';
    const apiKey = isCustom ? integration.credentials?.api_key : null;

    const platformColor = {
        loyverse: 'bg-emerald-100',
        ifood: 'bg-red-100',
        hubster: 'bg-blue-100',
        custom: 'bg-purple-100',
    }[integration.platform] ?? 'bg-muted';

    return (
        <Card className={`transition-all ${integration.status === 'connected' ? 'border-emerald-200 shadow-sm' : 'border-destructive/30'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${platformColor}`}>
                        {integration.platform === 'custom' ? <Globe className="h-5 w-5 text-purple-600" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold">{integration.name}</CardTitle>
                        <CardDescription className="text-xs">
                            {PLATFORMS.find(p => p.value === integration.platform)?.label ?? integration.platform}
                        </CardDescription>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    {integration.status === 'connected' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Online
                        </span>
                    ) : (
                        <Badge variant="destructive" className="text-xs h-5">Desconectado</Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                    <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Última sync</span>
                    <span className="font-medium text-foreground">
                        {integration.last_sync_at
                            ? formatInBrasilia(integration.last_sync_at, 'dd/MM/yyyy HH:mm')
                            : 'Nunca'}
                    </span>
                </div>

                {/* Loyverse webhook URL */}
                {integration.platform === 'loyverse' && (
                    <div className="space-y-1.5 border-t pt-3">
                        <p className="text-xs font-medium flex items-center gap-1"><Webhook className="h-3 w-3" /> Webhook URL (cole no Loyverse)</p>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={WEBHOOK_URL} className="h-7 text-xs bg-muted" />
                            <CopyButton value={WEBHOOK_URL} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Loyverse → Configurações → Webhooks → cole esta URL para receber vendas em tempo real.
                        </p>
                    </div>
                )}

                {/* Generic API Key */}
                {isCustom && apiKey && (
                    <div className="space-y-1.5 border-t pt-3">
                        <p className="text-xs font-medium flex items-center gap-1"><Key className="h-3 w-3" /> API Key</p>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={apiKey} type="password" className="h-7 text-xs bg-muted" />
                            <CopyButton value={apiKey} />
                        </div>
                        <p className="text-xs font-medium flex items-center gap-1 pt-1"><Globe className="h-3 w-3" /> Endpoint</p>
                        <div className="flex items-center gap-2">
                            <Input readOnly value={GENERIC_API_URL} className="h-7 text-xs bg-muted" />
                            <CopyButton value={GENERIC_API_URL} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Envie POST com header <code className="bg-muted px-1 rounded">x-api-key</code> para registrar vendas de qualquer PDV.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2 border-t pt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={onSync}
                        disabled={isSyncing}
                    >
                        <RefreshCw className={`mr-1.5 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={onDelete}
                    >
                        <Trash2 className="mr-1.5 h-3 w-3" />
                        Desconectar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return 'azk_' + Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function ConfiguracaoPDV() {
    const { integrations, isLoading, createIntegration, deleteIntegration, syncIntegration } = usePosIntegrations();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newIntegration, setNewIntegration] = useState({
        platform: '',
        name: '',
        token: '',
        clientId: '',
        clientSecret: '',
    });

    const getPlatformName = (platform: string) =>
        PLATFORMS.find(p => p.value === platform)?.label ?? platform;

    const handleConnect = () => {
        const { platform, name, token, clientId, clientSecret } = newIntegration;
        let credentials: Record<string, string> = {};

        if (platform === 'loyverse') {
            if (!token.trim()) return toast.error('Token de Acesso é obrigatório!');
            credentials = { access_token: token.trim() };
        } else if (platform === 'ifood') {
            if (!clientId.trim() || !clientSecret.trim()) return toast.error('Client ID e Client Secret são obrigatórios!');
            credentials = { client_id: clientId.trim(), client_secret: clientSecret.trim() };
        } else if (platform === 'custom') {
            credentials = { api_key: generateApiKey() };
        } else {
            return toast.error('Plataforma não suportada para conexão direta. Entre em contato com o suporte.');
        }

        createIntegration.mutate(
            { platform, name: name || getPlatformName(platform), credentials },
            {
                onSuccess: () => {
                    setIsAddDialogOpen(false);
                    setNewIntegration({ platform: '', name: '', token: '', clientId: '', clientSecret: '' });
                },
            }
        );
    };

    const platformGuide = () => {
        switch (newIntegration.platform) {
            case 'loyverse': return <LoyverseGuide />;
            case 'ifood': return <IFoodGuide />;
            case 'custom': return <CustomGuide />;
            case 'hubster': return (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-lg flex gap-3 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p>Para conectar ao Hubster/Otter, precisamos gerar um link de parceiro exclusivo para sua conta. Entre em contato com o suporte Azura para liberar sua chave privada.</p>
                </div>
            );
            default: return null;
        }
    };

    const credentialFields = () => {
        if (newIntegration.platform === 'loyverse') return (
            <div className="space-y-2">
                <Label>Token de Acesso (Access Token)</Label>
                <Input
                    type="password"
                    placeholder="eyX..."
                    value={newIntegration.token}
                    onChange={e => setNewIntegration({ ...newIntegration, token: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">Mantenha sua chave segura. Não compartilhe com ninguém.</p>
            </div>
        );
        if (newIntegration.platform === 'ifood') return (
            <div className="space-y-3">
                <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                        placeholder="Client ID do Portal iFood"
                        value={newIntegration.clientId}
                        onChange={e => setNewIntegration({ ...newIntegration, clientId: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={newIntegration.clientSecret}
                        onChange={e => setNewIntegration({ ...newIntegration, clientSecret: e.target.value })}
                    />
                </div>
            </div>
        );
        if (newIntegration.platform === 'custom') return (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2 text-sm text-purple-800">
                <Key className="h-4 w-4 shrink-0 mt-0.5" />
                <p>Uma <strong>API Key exclusiva</strong> será gerada automaticamente ao conectar. Você poderá copiá-la no card da integração.</p>
            </div>
        );
        return null;
    };

    const canConnect = newIntegration.platform && newIntegration.platform !== 'hubster';

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            <PageHeader
                title="Integrações PDV"
                description="Conecte qualquer sistema de PDV ao Azura para sincronização automática e contínua de vendas e estoque"
                action={{ label: 'Adicionar PDV', onClick: () => setIsAddDialogOpen(true), icon: Plus }}
            />

            {/* Platform showcase */}
            {integrations.length === 0 && !isLoading && (
                <div className="space-y-4">
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Link className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Nenhum PDV conectado</h3>
                            <p className="text-muted-foreground max-w-md mb-6 text-sm">
                                Conecte o Azura a qualquer PDV para dar baixa automática no estoque e fichas técnicas a cada venda.
                            </p>
                            <Button onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Primeira Conexão
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {PLATFORMS.map(p => (
                            <button
                                key={p.value}
                                className="text-left border rounded-xl p-4 hover:border-primary/50 hover:bg-muted/50 transition-all"
                                onClick={() => { setNewIntegration(n => ({ ...n, platform: p.value, name: p.label })); setIsAddDialogOpen(true); }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    {p.value === 'custom' ? <Globe className="h-4 w-4 text-purple-600" /> : <Store className="h-4 w-4 text-muted-foreground" />}
                                    <span className="text-sm font-medium">{p.label}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{p.description}</p>
                                <div className="flex items-center gap-1 mt-3 text-xs text-primary font-medium">
                                    Conectar <ArrowRight className="h-3 w-3" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {integrations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {integrations.map(integration => (
                        <IntegrationCard
                            key={integration.id}
                            integration={integration}
                            onSync={() => syncIntegration.mutate(integration.id)}
                            isSyncing={syncIntegration.isPending && syncIntegration.variables === integration.id}
                            onDelete={() => {
                                if (window.confirm('Tem certeza que deseja desconectar e remover este PDV?')) {
                                    deleteIntegration.mutate(integration.id);
                                }
                            }}
                        />
                    ))}

                    <button
                        className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <Plus className="h-6 w-6" />
                        <span className="text-sm font-medium">Adicionar outro PDV</span>
                    </button>
                </div>
            )}

            {/* Add dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Conectar Sistema PDV</DialogTitle>
                        <DialogDescription>
                            Siga o guia abaixo para integrar seu sistema ao Azura Gastrosense.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Platform selector */}
                        <div className="space-y-2">
                            <Label>Sistema / Plataforma</Label>
                            <Select
                                value={newIntegration.platform}
                                onValueChange={val => setNewIntegration({ platform: val, name: getPlatformName(val), token: '', clientId: '', clientSecret: '' })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o provedor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORMS.map(p => (
                                        <SelectItem key={p.value} value={p.value}>
                                            <div>
                                                <span className="font-medium">{p.label}</span>
                                                <span className="text-muted-foreground ml-2 text-xs">{p.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Display name */}
                        {newIntegration.platform && (
                            <div className="space-y-2">
                                <Label>Nome de Exibição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                                <Input
                                    value={newIntegration.name}
                                    onChange={e => setNewIntegration({ ...newIntegration, name: e.target.value })}
                                    placeholder={`Ex: ${getPlatformName(newIntegration.platform)} Matriz`}
                                />
                            </div>
                        )}

                        {/* Step-by-step guide */}
                        {newIntegration.platform && (
                            <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
                                {platformGuide()}
                            </div>
                        )}

                        {/* Credential fields */}
                        {credentialFields()}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleConnect}
                            disabled={!canConnect || createIntegration.isPending}
                        >
                            {createIntegration.isPending ? (
                                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" /> Autenticar e Conectar</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    Link,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Smartphone,
    Globe,
    Settings2,
    Save,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoPDV() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [ifoodConnected, setIfoodConnected] = useState(false);

    const handleConnect = (platform: string) => {
        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 2000)),
            {
                loading: `Conectando ao ${platform}...`,
                success: `${platform} conectado com sucesso!`,
                error: `Erro ao conectar ao ${platform}.`,
            }
        );
        if (platform === 'iFood') setIfoodConnected(true);
    };

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            toast.success('Cardápio sincronizado com sucesso!');
        }, 3000);
    };

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            <PageHeader
                title="Configurações PDV"
                description="Conecte seu sistema com plataformas externas de delivery e vendas"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Platform: iFood */}
                    <Card className={ifoodConnected ? "border-emerald-200" : ""}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                                    <img src="https://logodownload.org/wp-content/uploads/2017/05/ifood-logo-0.png" alt="iFood" className="w-8 h-auto object-contain" />
                                </div>
                                <div>
                                    <CardTitle>iFood Integration</CardTitle>
                                    <CardDescription>Sincronize pedidos e cardápio automaticamente</CardDescription>
                                </div>
                            </div>
                            <Badge variant={ifoodConnected ? "default" : "secondary"} className={ifoodConnected ? "bg-emerald-100 text-emerald-700" : ""}>
                                {ifoodConnected ? "Conectado" : "Desconectado"}
                            </Badge>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Client ID</Label>
                                    <Input placeholder="Client ID do Portal do Parceiro" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Secret</Label>
                                    <Input type="password" placeholder="••••••••••••••••" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-medium">Sincronização Automática</span>
                                </div>
                                <Switch disabled={!ifoodConnected} />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={() => handleConnect('iFood')}
                                    disabled={ifoodConnected}
                                >
                                    {ifoodConnected ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Link className="mr-2 h-4 w-4" />}
                                    {ifoodConnected ? "iFood Conectado" : "Conectar iFood"}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    disabled={!ifoodConnected || isSyncing}
                                    onClick={handleSync}
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                    Sincronizar Agora
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Platform: Hubster */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Globe className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle>Hubster (Otter)</CardTitle>
                                    <CardDescription>Gerencie múltiplos canais em um só lugar</CardDescription>
                                </div>
                            </div>
                            <Badge variant="secondary">Indisponível</Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                A integração com Hubster permite consolidar pedidos de Rappi, Uber Eats e outros apps diretamente no Azura.
                            </p>
                            <Button variant="outline" className="w-full" disabled>
                                Solicitar Acesso
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Settings2 className="h-4 w-4 text-primary" />
                                Status Global
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Última Sincronização</span>
                                <span className="font-medium">Hoje, 14:20</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Pedidos baixados (mês)</span>
                                <span className="font-medium">1,248</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Conexão API</span>
                                <Badge className="bg-emerald-500 hover:bg-emerald-600">Estável</Badge>
                            </div>
                            <div className="pt-2">
                                <Button variant="outline" size="sm" className="w-full text-[10px] uppercase font-bold tracking-wider">
                                    Ver Logs de Integração
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Webhook URL</CardTitle>
                            <CardDescription className="text-[10px]">Use esta URL para configurar notificações push</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="p-2 bg-muted rounded border font-mono text-[10px] break-all">
                                https://api.azura.com/webhooks/pos/v1/xyz-123
                            </div>
                            <Button size="sm" variant="ghost" className="w-full h-8 flex items-center gap-2">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Copiar Link
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

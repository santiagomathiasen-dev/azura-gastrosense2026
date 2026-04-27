import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/shared/useAuth";
import { usePlanLimits, PLAN_PRICES } from "@/hooks/shared/usePlanLimits";
import { useProfile } from "@/hooks/shared/useProfile";
import { LogOut, QrCode, Copy, CheckCircle2, MessageSquare, CreditCard, Clock } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/navigation";

export default function PaymentRequired() {
    const { user, logout } = useAuth();
    const { profile, refetch } = useProfile();
    const { isTrialExpired, isSubscriptionExpired } = usePlanLimits();
    const router = useRouter();
    const [copied, setCopied] = useState(false);
    const pixKey = process.env.NEXT_PUBLIC_PIX_KEY || '';
    const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '';

    // Listen for realtime profile updates (payment webhook)
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('payment-status')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${user.id}`,
            }, (payload) => {
                if (payload.new?.status_pagamento === true) {
                    toast.success('Pagamento confirmado! Redirecionando...');
                    setTimeout(() => router.push('/dashboard'), 1500);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id, router]);

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    const openWhatsApp = () => {
        const message = "Ola, realizei o pagamento da minha assinatura Azura GastroSense.";
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleVerifyPayment = async () => {
        await refetch();
        if (profile?.status_pagamento === true) {
            toast.success('Pagamento confirmado!');
            router.push('/dashboard');
        } else {
            toast.info('Pagamento ainda nao confirmado. Tente novamente em alguns minutos.');
        }
    };

    // Determine which message to show
    const isExpiredSub = isSubscriptionExpired;
    const isExpiredTrial = isTrialExpired;

    const title = isExpiredSub
        ? 'Assinatura Expirada'
        : isExpiredTrial
            ? 'Periodo de Teste Encerrado'
            : 'Pagamento Necessario';

    const description = isExpiredSub
        ? 'Sua assinatura expirou. Renove para continuar usando o Azura GastroSense.'
        : isExpiredTrial
            ? 'Seu periodo de teste de 7 dias terminou. Assine para continuar.'
            : 'Realize o pagamento para liberar o acesso ao sistema.';

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="max-w-md w-full shadow-lg border-primary/20">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                        {isExpiredSub ? (
                            <CreditCard className="h-8 w-8 text-primary" />
                        ) : isExpiredTrial ? (
                            <Clock className="h-8 w-8 text-primary" />
                        ) : (
                            <QrCode className="h-8 w-8 text-primary" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold">{title}</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Plan info */}
                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 text-center space-y-1">
                        <p className="text-sm font-medium">Plano Pro</p>
                        <p className="text-3xl font-bold text-primary">R$ {PLAN_PRICES.pro.monthly}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                        <p className="text-xs text-muted-foreground">30 dias de acesso completo</p>
                    </div>

                    {/* PIX key */}
                    {pixKey && (
                        <div className="bg-secondary/50 p-4 rounded-lg border space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Chave PIX (Email)</p>
                            <div className="flex items-center justify-between gap-2 bg-background p-3 rounded-md border border-primary/10">
                                <code className="text-sm font-mono break-all font-bold text-primary">{pixKey}</code>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCopyPix}>
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {/* Verify payment */}
                        <Button variant="default" className="w-full" onClick={handleVerifyPayment}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Verificar Pagamento
                        </Button>

                        {/* WhatsApp support */}
                        {phone && (
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 font-semibold"
                                onClick={openWhatsApp}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Suporte WhatsApp
                            </Button>
                        )}

                        {/* Subscription page link */}
                        <Button variant="secondary" className="w-full" onClick={() => router.push('/assinatura')}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Ver Planos e Pagamento Online
                        </Button>

                        <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => logout()}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sair da conta
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

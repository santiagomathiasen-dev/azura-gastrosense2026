'use client';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { CreditCard, LogOut, MessageSquare, Copy, CheckCircle2, QrCode, RefreshCw, Wallet, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PaymentRequiredPage() {
    const { logout } = useAuth();
    const { profile, refetch } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isVerifying, setIsVerifying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [capturingPaypal, setCapturingPaypal] = useState(false);
    const [pixData, setPixData] = useState<{ qrCode: string, qrCodeBase64: string } | null>(null);
    const [pixCopied, setPixCopied] = useState(false);

    const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '';

    // Auto-redirect when payment is confirmed via Realtime
    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase
            .channel('profile_changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${profile.id}`
                },
                (payload) => {
                    const newProfile = payload.new as any;
                    if (newProfile.status_pagamento === true) {
                        toast.success("Pagamento confirmado com sucesso!");
                        router.push('/dashboard');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, router]);

    // Auto-capture PayPal order when user returns from PayPal approval
    useEffect(() => {
        const token = searchParams.get('token'); // PayPal order ID
        const payerId = searchParams.get('PayerID');
        if (!token || !payerId || !profile?.id || capturingPaypal) return;

        const capturePaypal = async () => {
            setCapturingPaypal(true);
            toast.loading("Finalizando pagamento PayPal...", { id: 'paypal-capture' });
            try {
                const { data, error } = await supabase.functions.invoke('capture-paypal', {
                    body: { orderId: token, userId: profile.id },
                });
                if (error) throw error;
                toast.success("Pagamento confirmado! Liberando acesso...", { id: 'paypal-capture' });
                router.push('/dashboard');
            } catch (err: any) {
                toast.error(err.message || "Erro ao finalizar pagamento PayPal", { id: 'paypal-capture' });
                setCapturingPaypal(false);
            }
        };

        capturePaypal();
    }, [searchParams, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogout = async () => {
        await logout();
        router.push('/auth');
    };

    const handleCopyPix = (text: string) => {
        navigator.clipboard.writeText(text);
        setPixCopied(true);
        toast.success("Código PIX copiado!");
        setTimeout(() => setPixCopied(false), 2000);
    };

    const handleVerifyPayment = async () => {
        setIsVerifying(true);
        const { data } = await refetch();
        
        const isPaid = data?.status_pagamento === true && (!data?.subscription_end_date || new Date(data.subscription_end_date) > new Date());
        
        if (isPaid) {
            toast.success("Pagamento confirmado! Liberando acesso...");
            router.push('/dashboard');
        } else {
            toast.error("Pagamento ainda não identificado. Se já pagou, aguarde alguns minutos.");
        }
        setIsVerifying(false);
    };

    const openWhatsApp = () => {
        const message = "Olá, realizei o pagamento da minha assinatura e gostaria de liberar meu acesso.";
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    const handleCheckout = async (planId: string, method: 'mercadopago' | 'paypal' | 'pix') => {
        try {
            setLoading(true);
            setPixData(null); // Reset pix data
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                toast.error("Você precisa estar logado para assinar.");
                return;
            }

            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: { 
                    userId: user.id, 
                    planId, 
                    userEmail: user.email,
                    paymentMethod: method 
                }
            });

            if (error) throw error;

            if (method === 'pix' && data?.qrCode) {
                setPixData({
                    qrCode: data.qrCode,
                    qrCodeBase64: data.qrCodeBase64
                });
                toast.success("PIX Gerado! Pague agora para liberar o acesso.");
            } else if (data?.checkoutUrl) {
                window.open(data.checkoutUrl, '_blank');
            } else {
                throw new Error("Não foi possível gerar o link de pagamento.");
            }
        } catch (error: any) {
            console.error("Checkout error:", error);
            toast.error(error.message || "Erro ao processar checkout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 font-sans">
            {capturingPaypal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-lg font-semibold">Finalizando pagamento PayPal...</p>
                        <p className="text-sm text-muted-foreground">Aguarde, estamos confirmando com o PayPal.</p>
                    </div>
                </div>
            )}
            <Card className="max-w-2xl w-full border-border/50 shadow-2xl overflow-hidden bg-card">
                <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60 w-full" />
                
                <div className="grid md:grid-cols-5 h-full">
                    {/* INFO SIDEBAR */}
                    <div className="md:col-span-2 bg-muted/40 p-8 border-r border-border/50 flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold mb-4 text-foreground">Plano Pro</h2>
                            <p className="text-2xl font-bold text-primary mb-6">R$ 197 <span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Dashboard e Relatórios Financeiros</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Gestão de Estoque e Compras</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Engenharia de Cardápio (CVM)</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Suporte via WhatsApp</span>
                                </li>
                            </ul>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border/50">
                            <Button variant="ghost" className="w-full justify-start p-0 h-auto text-muted-foreground hover:text-destructive transition-colors text-xs" onClick={handleLogout}>
                                <LogOut className="mr-2 h-3 w-3" />
                                Sair da Conta
                            </Button>
                        </div>
                    </div>

                    {/* PAYMENT OPTIONS */}
                    <div className="md:col-span-3 p-8 flex flex-col gap-6">
                        <div className="text-center md:text-left">
                            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Finalize sua Assinatura</CardTitle>
                            <CardDescription className="text-base mt-1">
                                Libere seu acesso imediatamente com um dos métodos abaixo.
                            </CardDescription>
                        </div>

                        <div className="space-y-3">
                            {/* PIX BUTTON (AUTOMATED) */}
                            <Button 
                                className="w-full h-14 justify-between px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl transition-all shadow-md group"
                                onClick={() => handleCheckout('pro', 'pix')}
                                disabled={loading}
                            >
                                <span className="flex items-center gap-3">
                                    {loading ? <RefreshCw className="h-6 w-6 animate-spin" /> : <QrCode className="h-6 w-6" />}
                                    Pagar com PIX Automático
                                </span>
                                <span className="text-sm font-normal opacity-0 group-hover:opacity-100 transition-opacity underline">Gerar QR →</span>
                            </Button>

                            {/* PAYPAL / CARD BUTTON */}
                            <Button 
                                className="w-full h-14 justify-between px-6 bg-[#003087] hover:bg-[#00246B] text-white font-bold text-lg rounded-xl transition-all shadow-md group"
                                onClick={() => handleCheckout('pro', 'paypal')}
                                disabled={loading}
                            >
                                <span className="flex items-center gap-3">
                                    {loading ? <RefreshCw className="h-6 w-6 animate-spin" /> : <CreditCard className="h-6 w-6" />}
                                    Cartão / PayPal
                                </span>
                                <span className="text-sm font-normal opacity-0 group-hover:opacity-100 transition-opacity underline">Pagar →</span>
                            </Button>
                        </div>

                        {/* PIX DISPLAY AREA (AUTOMATED) */}
                        {pixData && (
                            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Escaneie o QR Code</p>
                                    <div className="bg-white p-4 rounded-xl shadow-sm inline-block border border-emerald-200">
                                        <img 
                                            src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`} 
                                            alt="PIX QR Code" 
                                            className="w-48 h-48 mx-auto"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-emerald-700 text-center uppercase">Ou copie o código:</p>
                                    <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-emerald-200 shadow-inner">
                                        <code className="text-[10px] font-mono font-bold text-emerald-900 break-all line-clamp-2 flex-1">
                                            {pixData.qrCode}
                                        </code>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-10 w-10 shrink-0 text-emerald-600 hover:bg-emerald-50" 
                                            onClick={() => handleCopyPix(pixData.qrCode)}
                                        >
                                            {pixCopied ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-medium animate-pulse">
                                    <Clock className="h-3 w-3" />
                                    <span>Aguardando confirmação...</span>
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase font-medium">
                                <span className="bg-card px-2 text-muted-foreground italic">Se o automático falhar:</span>
                            </div>
                        </div>

                        {/* MANUAL PIX FALLBACK */}
                        <Card className="bg-muted/30 border-dashed border-border p-5 rounded-2xl space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <QrCode className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">PIX Manual (E-mail)</h4>
                                    <p className="text-xs text-muted-foreground">Pague para esta chave e envie o comprovante.</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-primary/20 shadow-sm">
                                <code className="text-sm font-mono font-bold text-primary select-all">{process.env.NEXT_PUBLIC_PIX_KEY}</code>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => handleCopyPix(process.env.NEXT_PUBLIC_PIX_KEY || '')}
                                >
                                    {pixCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>

                            <Button
                                className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-none font-bold gap-2 text-sm h-11 transition-all shadow-none"
                                onClick={openWhatsApp}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Confirmar pelo WhatsApp (Envio de Comprovante)
                            </Button>
                        </Card>

                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <Button
                                variant="ghost"
                                className="h-12 gap-2 text-muted-foreground hover:bg-accent transition-all font-medium text-sm"
                                onClick={handleVerifyPayment}
                                disabled={isVerifying}
                            >
                                <RefreshCw className={cn("h-4 w-4", isVerifying && "animate-spin")} />
                                Verificar Agora
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-12 gap-2 text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm border border-blue-100 rounded-xl"
                                onClick={() => handleCheckout('pro', 'mercadopago')}
                                disabled={loading}
                            >
                                <Wallet className="h-4 w-4" />
                                Outras Opções (Mercado Pago)
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

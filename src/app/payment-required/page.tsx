'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, LogOut, MessageSquare, Copy, CheckCircle2, QrCode, RefreshCw, Wallet, ShieldCheck, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function PaymentRequiredPage() {
    const { logout } = useAuth();
    const { profile, refetch } = useProfile();
    const router = useRouter();
    const [copied, setCopied] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    
    const pixKey = "santiago.aloom@gmail.com";
    const phone = "61982452669";

    const handleLogout = async () => {
        await logout();
        router.push('/auth');
    };

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleVerifyPayment = async () => {
        setIsVerifying(true);
        const { data } = await refetch();
        
        // If payment status updated or date is now in future
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 font-sans">
            <Card className="max-w-2xl w-full border-border/50 shadow-2xl overflow-hidden bg-card">
                <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60 w-full" />
                
                <div className="grid md:grid-cols-5 h-full">
                    {/* INFO SIDEBAR */}
                    <div className="md:col-span-2 bg-muted/40 p-8 border-r border-border/50 flex flex-col justify-between">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 border border-primary/20">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                            </div>
                            <h2 className="text-xl font-bold mb-4">Plano Pro</h2>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Acesso total ao Dashboard e Relatórios</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Gestão Completa de Estoque e Produção</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Fichas Técnicas e Cálculo de CMV</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <span>Suporte Prioritário via WhatsApp</span>
                                </li>
                            </ul>
                        </div>

                        <div className="mt-8 pt-8 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                                <Clock className="h-3 w-3" />
                                <span>Teste grátis de 7 dias encerrado</span>
                            </div>
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
                                Escolha o método de pagamento para liberar seu acesso imediatamente.
                            </CardDescription>
                        </div>

                        <div className="space-y-3">
                            <Button 
                                className="w-full h-14 justify-between px-6 bg-[#009EE3] hover:bg-[#0089C7] text-white font-bold text-lg rounded-xl transition-all shadow-md group"
                                onClick={() => window.open('https://www.mercadopago.com.br/', '_blank')}
                            >
                                <span className="flex items-center gap-3">
                                    <Wallet className="h-6 w-6" />
                                    Mercado Pago
                                </span>
                                <span className="text-sm font-normal opacity-0 group-hover:opacity-100 transition-opacity underline">Pagar agora →</span>
                            </Button>

                            <Button 
                                className="w-full h-14 justify-between px-6 bg-[#003087] hover:bg-[#00246B] text-white font-bold text-lg rounded-xl transition-all shadow-md group"
                                onClick={() => window.open('https://www.paypal.com/br/', '_blank')}
                            >
                                <span className="flex items-center gap-3">
                                    <CreditCard className="h-6 w-6" />
                                    PayPal / Cartão
                                </span>
                                <span className="text-sm font-normal opacity-0 group-hover:opacity-100 transition-opacity underline">Checkout →</span>
                            </Button>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">Ou via PIX</span>
                            </div>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-xl border border-border/50 space-y-3 shadow-inner">
                            <div className="flex items-center justify-between gap-3 bg-background p-3 rounded-lg border border-primary/20 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <QrCode className="h-4 w-4 text-primary" />
                                    <code className="text-sm font-mono font-bold text-primary select-all">{pixKey}</code>
                                </div>
                                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors" onClick={handleCopyPix}>
                                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-auto">
                            <Button
                                variant="outline"
                                className="h-12 gap-2 border-border/50 hover:bg-accent transition-all font-medium text-sm"
                                onClick={handleVerifyPayment}
                                disabled={isVerifying}
                            >
                                <RefreshCw className={cn("h-4 w-4", isVerifying && "animate-spin")} />
                                {isVerifying ? 'Verificando...' : 'Já Paguei'}
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 gap-2 border-green-500/30 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-500 transition-all font-medium text-sm"
                                onClick={openWhatsApp}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Suporte
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

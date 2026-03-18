'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Wallet, 
  QrCode, 
  MessageSquare,
  Copy,
  Calendar,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AssinaturaPage() {
    const { profile } = useProfile();
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const pixKey = "santiago.aloom@gmail.com";
    const phone = "61982452669";

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    const openWhatsApp = () => {
        const message = "Olá, gostaria de falar sobre minha assinatura do Azura.";
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };
    
    const handleCheckout = async (planId: string, method: 'mercadopago' | 'paypal') => {
        try {
            setLoading(true);
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
            if (data?.checkoutUrl) {
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

    const isTrial = !profile?.status_pagamento;
    const expiryDate = profile?.subscription_end_date ? new Date(profile.subscription_end_date) : null;
    const isExpired = expiryDate ? expiryDate < new Date() : false;

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Minha Assinatura</h1>
                <p className="text-muted-foreground text-lg">Gerencie seu plano e pagamentos do Azura GastroSense.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* STATUS CARD */}
                <Card className="md:col-span-1 border-primary/20 bg-primary/5 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Status Atual
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Plano</p>
                            <p className="text-2xl font-bold text-primary">Azura Pro</p>
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Estado</p>
                            <div className="flex items-center gap-2">
                                {isTrial ? (
                                    <span className="flex items-center gap-2 text-amber-600 font-semibold bg-amber-50 px-3 py-1 rounded-full text-sm border border-amber-200">
                                        <Clock className="h-4 w-4" />
                                        Período de Teste
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2 text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full text-sm border border-green-200">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Assinatura Ativa
                                    </span>
                                )}
                            </div>
                        </div>

                        {expiryDate && (
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vencimento</p>
                                <div className="flex items-center gap-2 text-foreground font-medium">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {format(expiryDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </div>
                                {isExpired && <p className="text-xs text-destructive font-bold mt-1">Sua assinatura expirou!</p>}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="pt-0">
                        <Button variant="outline" className="w-full text-xs h-8" onClick={openWhatsApp}>
                            Alterar Plano / Cancelar
                        </Button>
                    </CardFooter>
                </Card>

                {/* PAYMENT OPTIONS */}
                <Card className="md:col-span-2 shadow-sm border-border/50 overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b border-border/50">
                        <CardTitle className="text-xl">Opções de Pagamento</CardTitle>
                        <CardDescription>Escolha como deseja realizar a renovação ou upgrade da sua conta.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Button 
                                    className="w-full h-12 justify-center gap-3 bg-[#009EE3] hover:bg-[#0089C7] text-white font-bold rounded-lg transition-all shadow-sm"
                                    onClick={() => handleCheckout('pro', 'mercadopago')}
                                    disabled={loading}
                                >
                                    {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                                    Mercado Pago
                                </Button>

                                <Button 
                                    className="w-full h-12 justify-center gap-3 bg-[#003087] hover:bg-[#00246B] text-white font-bold rounded-lg transition-all shadow-sm"
                                    onClick={() => handleCheckout('pro', 'paypal')}
                                    disabled={loading}
                                >
                                    {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                                    PayPal / Cartão
                                </Button>
                            </div>

                            <div className="bg-muted/40 p-4 rounded-xl border border-border/50 space-y-3 shadow-inner flex flex-col justify-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-center">Pagamento via PIX</p>
                                <div className="flex items-center justify-between gap-3 bg-background p-3 rounded-lg border border-primary/20 shadow-sm">
                                    <code className="text-xs font-mono font-bold text-primary select-all truncate">{pixKey}</code>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 hover:bg-primary/10 hover:text-primary" onClick={handleCopyPix}>
                                        {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-center text-muted-foreground leading-tight">
                                    Envie o comprovante via WhatsApp para liberação manual imediata.
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 p-4 bg-primary/5 rounded-lg border border-primary/10">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                Precisa de ajuda com o pagamento?
                            </h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Nosso suporte financeiro está disponível para tirar dúvidas sobre faturamento, notas fiscais e formas de pagamento customizadas.
                            </p>
                            <Button className="bg-green-600 hover:bg-green-700 h-9 text-xs" onClick={openWhatsApp}>
                                Falar com Suporte WhatsApp
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

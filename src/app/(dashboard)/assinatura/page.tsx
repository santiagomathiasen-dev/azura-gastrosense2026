'use client';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/shared/useProfile";
import { usePlanLimits, PLAN_PRICES } from "@/hooks/shared/usePlanLimits";
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, Wallet, CreditCard,
  MessageSquare, Copy, RefreshCw, Zap, Star, Rocket
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

const plans = [
  {
    id: 'gratis',
    icon: Clock,
    name: 'Grátis',
    price: 0,
    period: '7 dias',
    description: 'Teste todas as funcionalidades por 7 dias sem custos.',
    color: 'text-muted-foreground',
    border: 'border-border/50',
    badge: null,
    features: [
      { label: 'Todas as funcionalidades', ok: true },
      { label: '5 fichas técnicas', ok: true },
      { label: '1 gestor', ok: true },
      { label: '1 colaborador', ok: true },
      { label: 'Bloqueio total após 7 dias', ok: true },
      { label: 'Dados deletados após o prazo', ok: true },
    ],
  },
  {
    id: 'pro',
    icon: Star,
    name: 'Pro',
    price: 197,
    period: 'mês',
    description: 'Para operações em crescimento com limites generosos.',
    color: 'text-blue-600',
    border: 'border-blue-400',
    badge: 'Mais popular',
    features: [
      { label: 'Todas as funcionalidades', ok: true },
      { label: '50 fichas técnicas', ok: true },
      { label: '2 gestores', ok: true },
      { label: '3 colaboradores', ok: true },
      { label: 'Sem bloqueio por tempo', ok: true },
      { label: 'Suporte prioritário', ok: true },
    ],
  },
  {
    id: 'ultra',
    icon: Rocket,
    name: 'Ultra',
    price: 397,
    period: 'mês',
    description: 'Operações exigentes. Sem limites, sem restrições.',
    color: 'text-amber-500',
    border: 'border-amber-400',
    badge: 'Sem limites',
    features: [
      { label: 'Todas as funcionalidades', ok: true },
      { label: 'Fichas técnicas ilimitadas', ok: true },
      { label: 'Gestores ilimitados', ok: true },
      { label: 'Colaboradores ilimitados', ok: true },
      { label: 'Sem bloqueio por tempo', ok: true },
      { label: 'Suporte dedicado 24h', ok: true },
    ],
  },
];

const pixKey = process.env.NEXT_PUBLIC_PIX_KEY || '';
const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '';

export default function AssinaturaPage() {
  const { profile } = useProfile();
  const { plan: currentPlan, isTrialExpired } = usePlanLimits();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    toast.success("Chave PIX copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = (planName?: string) => {
    const msg = planName
      ? `Olá! Gostaria de assinar o plano ${planName} do Azura GastroSense.`
      : "Olá, gostaria de falar sobre minha assinatura do Azura.";
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCheckout = async (planId: string, method: 'mercadopago' | 'paypal') => {
    const key = `${planId}-${method}`;
    try {
      setLoading(key);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado."); return; }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { userId: user.id, planId, userEmail: user.email, paymentMethod: method }
      });

      if (error) throw error;
      if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      } else {
        throw new Error("Não foi possível gerar o link de pagamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
        <p className="text-muted-foreground text-base">
          Escolha o plano ideal para o seu negócio gastronômico.
        </p>
      </div>

      {/* Status atual */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <span className="text-sm text-muted-foreground">Seu plano atual: </span>
          <span className="font-bold text-primary capitalize">{PLAN_PRICES[currentPlan]?.label || 'Grátis'}</span>
          {isTrialExpired && (
            <span className="ml-3 text-xs text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded-full">
              Trial expirado — faça upgrade para continuar
            </span>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = currentPlan === plan.id;
          const isSelected = selectedPlan === plan.id;

          return (
            <Card
              key={plan.id}
              onClick={() => { if (plan.id !== 'gratis') setSelectedPlan(plan.id); }}
              className={`relative flex flex-col border-2 transition-all duration-200 cursor-pointer
                ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                ${isSelected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01]'}
                ${plan.border}
              `}
            >
              {/* Badge top */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={`text-xs px-3 py-0.5 ${plan.id === 'pro' ? 'bg-blue-600' : 'bg-amber-500'} text-white border-0`}>
                    {plan.badge}
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <Badge className="text-xs px-3 py-0.5 bg-primary text-primary-foreground border-0">Atual</Badge>
                </div>
              )}

              <CardHeader className="pb-2 pt-6">
                <div className={`flex items-center gap-2 ${plan.color}`}>
                  <Icon className="h-5 w-5" />
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                </div>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <p className="text-3xl font-extrabold">Grátis</p>
                  ) : (
                    <p className="text-3xl font-extrabold">
                      R$ {plan.price.toLocaleString('pt-BR')}
                      <span className="text-base font-normal text-muted-foreground">/{plan.period}</span>
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>
              </CardHeader>

              <CardContent className="flex-1 py-4">
                <ul className="space-y-2">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {feat.ok
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive/60 shrink-0" />
                      }
                      <span className={feat.ok ? '' : 'text-muted-foreground line-through'}>{feat.label}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex flex-col gap-2 pt-0">
                {plan.id === 'gratis' ? (
                  <div className="w-full mt-auto">
                    {isCurrent ? (
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-center text-sm font-bold text-primary">
                        Plano Atual
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full opacity-50" disabled>
                        Indisponível
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Button
                      className="w-full h-11 bg-[#009EE3] hover:bg-[#0089C7] text-white font-bold gap-2"
                      onClick={(e) => { e.stopPropagation(); handleCheckout(plan.id, 'mercadopago'); }}
                      disabled={!!loading}
                    >
                      {loading === `${plan.id}-mercadopago` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                      Mercado Pago
                    </Button>
                    <Button
                      className="w-full h-11 bg-[#003087] hover:bg-[#00246B] text-white font-bold gap-2"
                      onClick={(e) => { e.stopPropagation(); handleCheckout(plan.id, 'paypal'); }}
                      disabled={!!loading}
                    >
                      {loading === `${plan.id}-paypal` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      PayPal / Cartão
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-9 text-xs gap-2"
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(plan.name); }}
                    >
                      <MessageSquare className="h-3 w-3" /> PIX / WhatsApp
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* PIX info section */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold">Pagamento via PIX</p>
            <p className="text-xs text-muted-foreground">
              Envie para a chave abaixo e encaminhe o comprovante pelo WhatsApp para liberação manual imediata.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono font-bold text-primary select-all">{pixKey}</code>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyPix}>
                {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700 gap-2 shrink-0" onClick={() => openWhatsApp()}>
            <MessageSquare className="h-4 w-4" /> Falar no WhatsApp
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

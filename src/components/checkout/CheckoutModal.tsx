'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { QrCode, CreditCard, RefreshCw, Copy, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  planPrice: string;
  planFeatures: string[];
}

export function CheckoutModal({
  isOpen,
  onClose,
  planId,
  planName,
  planPrice,
  planFeatures,
}: CheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const handleCheckout = async (method: 'mercadopago' | 'paypal' | 'pix') => {
    try {
      setLoading(true);
      setPixData(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Você precisa estar logado para assinar.');
        onClose();
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          userId: user.id,
          planId,
          userEmail: user.email,
          paymentMethod: method,
        },
      });

      if (error) throw error;

      if (method === 'pix' && data?.qrCode) {
        setPixData({
          qrCode: data.qrCode,
          qrCodeBase64: data.qrCodeBase64,
        });
        toast.success('PIX Gerado! Pague agora para liberar o acesso.');
      } else if (data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
        toast.success('Abrindo página de pagamento...');
      } else {
        throw new Error('Não foi possível gerar o link de pagamento.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Erro ao processar checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = (text: string) => {
    navigator.clipboard.writeText(text);
    setPixCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setPixCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{planName}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            <span className="text-2xl font-bold text-foreground">{planPrice}</span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </DialogDescription>
        </DialogHeader>

        {/* FEATURES LIST */}
        {planFeatures.length > 0 && (
          <div className="space-y-3 my-6 max-h-40 overflow-y-auto">
            {planFeatures.map((feature, idx) => (
              <div key={idx} className="flex gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        )}

        {/* PAYMENT OPTIONS */}
        <div className="space-y-3">
          {/* PIX BUTTON */}
          <Button
            className="w-full h-12 justify-between px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all"
            onClick={() => handleCheckout('pix')}
            disabled={loading || !!pixData}
            aria-label="Pagar com PIX Automático"
          >
            <span className="flex items-center gap-3">
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <QrCode className="h-5 w-5" aria-hidden="true" />
              )}
              PIX Automático
            </span>
            {!loading && !pixData && (
              <span className="text-xs opacity-70">→</span>
            )}
          </Button>

          {/* PAYPAL / CARD BUTTON */}
          <Button
            className="w-full h-12 justify-between px-4 bg-[#003087] hover:bg-[#00246B] text-white font-semibold rounded-lg transition-all"
            onClick={() => handleCheckout('paypal')}
            disabled={loading}
            aria-label="Pagar com Cartão de Crédito ou PayPal"
          >
            <span className="flex items-center gap-3">
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              )}
              Cartão / PayPal
            </span>
            {!loading && (
              <span className="text-xs opacity-70">→</span>
            )}
          </Button>
        </div>

        {/* PIX DISPLAY */}
        {pixData && (
          <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="text-center space-y-2">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Escaneie o QR Code</p>
              <div className="bg-white p-3 rounded-lg inline-block border border-emerald-200">
                <img
                  src={`data:image/jpeg;base64,${pixData.qrCodeBase64}`}
                  alt="PIX QR Code para pagamento"
                  className="w-40 h-40"
                />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700 text-center uppercase">Ou copie o código:</p>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200">
                <code className="text-[9px] font-mono font-bold text-emerald-900 break-all flex-1 line-clamp-2">
                  {pixData.qrCode}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => handleCopyPix(pixData.qrCode)}
                  aria-label={pixCopied ? 'Código copiado' : 'Copiar código PIX'}
                >
                  {pixCopied ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-medium animate-pulse">
              <Clock className="h-3 w-3" aria-hidden="true" />
              <span>Aguardando confirmação...</span>
            </div>
          </div>
        )}

        {/* FOOTER TEXT */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Você será redirecionado após a confirmação do pagamento.
        </p>
      </DialogContent>
    </Dialog>
  );
}

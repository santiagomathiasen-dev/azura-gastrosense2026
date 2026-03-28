import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, QrCode, Copy, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function PaymentRequired() {
    const { logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const pixKey = process.env.NEXT_PUBLIC_PIX_KEY || '';
    const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '';

    const handleCopyPix = () => {
        navigator.clipboard.writeText(pixKey);
        setCopied(true);
        toast.success("Chave PIX copiada!");
        setTimeout(() => setCopied(false), 2000);
    };

    const openWhatsApp = () => {
        const message = "Olá, realizei o pagamento da minha assinatura.";
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            <Card className="max-w-md w-full shadow-lg border-primary/20">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                        <QrCode className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">seu teste acaabu</CardTitle>
                    <CardDescription className="text-base text-muted-foreground">
                        Realize o pagamento e envie o comprovante para liberação do acesso.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-secondary/50 p-4 rounded-lg border space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Chave PIX (Email)</p>
                        <div className="flex items-center justify-between gap-2 bg-background p-3 rounded-md border border-primary/10">
                            <code className="text-sm font-mono break-all font-bold text-primary">{pixKey}</code>
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCopyPix}>
                                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="text-center space-y-3">
                            <p className="text-sm font-medium">Suporte via WhatsApp:</p>
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700 font-semibold"
                                onClick={openWhatsApp}
                            >
                                <MessageSquare className="h-4 w-4" />
                                {phone}
                            </Button>
                        </div>

                        <div className="pt-4 space-y-2">
                            <Button variant="ghost" className="w-full text-muted-foreground hover:text-destructive" onClick={() => logout()}>
                                <LogOut className="h-4 w-4 mr-2" />
                                Sair da conta
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

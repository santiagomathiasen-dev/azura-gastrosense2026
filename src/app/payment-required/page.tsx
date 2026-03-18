'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, LogOut, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function PaymentRequiredPage() {
    const { logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/auth');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="max-w-md w-full border-border/50 shadow-xl">
                <CardHeader className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Assinatura Necessária</CardTitle>
                    <CardDescription>
                        Seu período de teste expirou ou o pagamento da sua assinatura está pendente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Para continuar utilizando todos os recursos do Azura GastroSense, por favor regularize sua assinatura ou entre em contato com o suporte.
                    </p>
                    <div className="bg-muted p-4 rounded-lg text-left">
                        <h4 className="text-sm font-semibold mb-2">Por que estou vendo isso?</h4>
                        <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
                            <li>Seu período de teste gratuito de 7 dias terminou.</li>
                            <li>Houve um problema com o processamento do seu último pagamento.</li>
                            <li>Sua conta foi desativada temporariamente.</li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                    <Button className="w-full" onClick={() => window.open('https://wa.me/5511999999999', '_blank')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Falar com Suporte
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sair da Conta
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

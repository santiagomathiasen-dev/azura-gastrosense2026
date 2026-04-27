import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { ExternalLink, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useSupplierMessages } from '@/hooks/purchases/useSupplierMessages';

interface WhatsAppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplierName: string;
    phoneNumber: string;
    supplierId: string;
    purchaseListId?: string;
    initialMessage?: string;
}

export function WhatsAppDialog({
    open,
    onOpenChange,
    supplierName,
    phoneNumber,
    supplierId,
    purchaseListId,
    initialMessage = '',
}: WhatsAppDialogProps) {
    const [message, setMessage] = useState(initialMessage);
    const { sendWhatsAppMessage, isSending } = useSupplierMessages();

    // Sync message when dialog opens with a new initialMessage
    useEffect(() => {
        if (open && initialMessage) {
            setMessage(initialMessage);
        }
        if (!open) {
            setMessage('');
        }
    }, [open, initialMessage]);

    const handleManualWhatsApp = () => {
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.length < 10) {
            toast.error('Número de telefone inválido. Verifique o cadastro do fornecedor.');
            return;
        }
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/55${cleanNumber}?text=${encodedMessage}`, '_blank');

        // We still log it as 'sent' (or 'manual') even if opening the link
        // To keep history of what was sent
        onOpenChange(false);
    };

    const handleAutomatedSend = async () => {
        const success = await sendWhatsAppMessage({
            supplierId,
            phoneNumber,
            message,
            purchaseListId
        });

        if (success) {
            onOpenChange(false);
        }
    };

    const handleCopyMessage = () => {
        navigator.clipboard.writeText(message);
        toast.success('Mensagem copiada!');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md mx-auto">
                <DialogHeader>
                    <DialogTitle className="text-base text-primary font-bold">
                        Enviar Pedido para {supplierName}
                    </DialogTitle>
                    <DialogDescription>
                        Edite a mensagem se necessário e escolha como enviar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="bg-muted p-3 rounded-md text-sm flex justify-between items-center">
                        <div>
                            <span className="font-semibold">Número:</span> {phoneNumber}
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleCopyMessage} className="h-7 px-2">
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copiar
                        </Button>
                    </div>

                    <Textarea
                        placeholder="Digite sua mensagem aqui..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={6}
                        className="resize-none text-sm"
                    />
                </div>

                <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                        variant="outline"
                        onClick={handleManualWhatsApp}
                        className="w-full sm:w-auto border-green-200 text-green-700 hover:bg-green-50"
                    >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir Web WhatsApp
                    </Button>
                    <Button
                        onClick={handleAutomatedSend}
                        disabled={!message.trim() || isSending}
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                    >
                        {isSending ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full mr-2" />
                        ) : (
                            <Send className="mr-2 h-4 w-4" />
                        )}
                        Enviar Direto (API)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

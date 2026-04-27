import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOwnerId } from '../shared/useOwnerId';
import { toast } from 'sonner';
import { getNow } from '@/lib/utils';

interface SendMessageParams {
    supplierId: string;
    phoneNumber: string;
    message: string;
    purchaseListId?: string;
}

export function useSupplierMessages() {
    const [isSending, setIsSending] = useState(false);
    const { ownerId } = useOwnerId();

    const sendWhatsAppMessage = async ({ supplierId, phoneNumber, message, purchaseListId }: SendMessageParams) => {
        setIsSending(true);
        try {
            if (!ownerId) throw new Error('Usuário não autenticado');

            // 1. Log message in database as 'pending'
            const { data: messageRecord, error: dbError } = await supabase
                .from('supplier_messages')
                .insert({
                    supplier_id: supplierId,
                    message_text: message,
                    whatsapp_status: 'pending',
                    purchase_list_id: purchaseListId,
                    user_id: ownerId,
                })
                .select()
                .single();

            if (dbError) throw new Error(`Erro ao salvar mensagem: ${dbError.message}`);

            // 2. Call Edge Function to send message
            const { data: functionData, error: functionError } = await supabase.functions.invoke('send-whatsapp', {
                body: {
                    to: phoneNumber,
                    message: message,
                },
            });

            if (functionError) {
                throw new Error(`Erro no envio WhatsApp: ${functionError.message}`);
            }

            if (functionData?.error) {
                throw new Error(`Erro no envio WhatsApp: ${JSON.stringify(functionData.error)}`);
            }

            // 3. Update message status to 'sent'
            await supabase
                .from('supplier_messages')
                .update({ whatsapp_status: 'sent', sent_at: getNow().toISOString() })
                .eq('id', messageRecord.id);

            toast.success('Mensagem enviada com sucesso!');
            return true;

        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            toast.error(error instanceof Error ? error.message : 'Erro desconhecido ao enviar mensagem');

            // Update status to 'failed' if we have a record
            // (This is tricky if we don't have the record ID here, but typical flow catches major errors)
            return false;
        } finally {
            setIsSending(false);
        }
    };

    return {
        sendWhatsAppMessage,
        isSending,
    };
}

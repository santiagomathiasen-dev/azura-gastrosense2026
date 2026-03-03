import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import { supabaseFetch } from '@/lib/supabase-fetch';

export interface FinishedProductionStock {
  id: string;
  user_id: string;
  technical_sheet_id: string;
  quantity: number;
  unit: string;
  notes: string | null;
  image_url?: string | null;
  praca?: string | null;
  created_at: string;
  updated_at: string;
  technical_sheet?: {
    id: string;
    name: string;
    yield_unit: string;
    image_url: string | null;
    minimum_stock: number;
  };
}

export function useFinishedProductionsStock() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: finishedStock = [], isLoading, error } = useQuery({
    queryKey: ['finished_productions_stock', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];
      try {
        const data = await supabaseFetch('finished_productions_stock?select=*,technical_sheet:technical_sheets(id,name,yield_unit,image_url,minimum_stock)&order=updated_at.desc');
        return data as unknown as FinishedProductionStock[];
      } catch (err) {
        console.error("Error fetching finished stock:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
    refetchInterval: 30_000,
  });

  const addFinishedProduction = useMutation({
    mutationFn: async (data: {
      technical_sheet_id: string;
      quantity: number;
      unit: string;
      notes?: string;
      image_url?: string;
    }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      // Get technical sheet to see if it has a default praca
      const sheetData = await supabaseFetch(`technical_sheets?id=eq.${data.technical_sheet_id}&select=id`);
      const sheet = Array.isArray(sheetData) ? sheetData[0] : sheetData;

      // Check if entry already exists for this technical sheet
      const existingData = await supabaseFetch(`finished_productions_stock?technical_sheet_id=eq.${data.technical_sheet_id}&select=id,quantity`);
      const existing = Array.isArray(existingData) ? existingData[0] : existingData;

      if (existing) {
        // Update existing entry
        const updateData: { quantity: number; notes?: string; image_url?: string } = {
          quantity: Number(existing.quantity) + data.quantity,
          notes: data.notes
        };
        if (data.image_url) updateData.image_url = data.image_url;

        await supabaseFetch(`finished_productions_stock?id=eq.${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData)
        });
      } else {
        // Create new entry
        const insertData: {
          user_id: string;
          technical_sheet_id: string;
          quantity: number;
          unit: string;
          notes?: string;
          image_url?: string;
        } = {
          user_id: ownerId,
          technical_sheet_id: data.technical_sheet_id,
          quantity: data.quantity,
          unit: data.unit,
          notes: data.notes
        };
        if (data.image_url) insertData.image_url = data.image_url;

        await supabaseFetch('finished_productions_stock', {
          method: 'POST',
          body: JSON.stringify(insertData)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      toast.success('Produção finalizada adicionada ao estoque!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao adicionar produção: ${err.message}`);
    },
  });

  const updateFinishedProduction = useMutation({
    mutationFn: async ({ id, quantity, unit, notes, image_url }: { id: string; quantity: number; unit?: string; notes?: string; image_url?: string }) => {
      const updateData: any = { quantity, notes };
      if (unit) updateData.unit = unit;
      if (image_url !== undefined) updateData.image_url = image_url || null;

      await supabaseFetch(`finished_productions_stock?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      toast.success('Quantidade atualizada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });

  const deleteFinishedProduction = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`finished_productions_stock?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      toast.success('Item removido do estoque!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  // Register loss for finished production - uses technical sheet cost
  const registerLoss = useMutation({
    mutationFn: async ({ id, quantity = 1 }: { id: string; quantity?: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const item = finishedStock.find(s => s.id === id);
      if (!item) throw new Error('Item não encontrado');

      if (Number(item.quantity) < quantity) {
        throw new Error('Quantidade insuficiente para registrar perda.');
      }

      // Get the technical sheet to calculate the cost
      const technicalSheetData = await supabaseFetch(`technical_sheets?id=eq.${item.technical_sheet_id}&select=cost_per_unit,total_cost,yield_quantity`);
      const technicalSheet = Array.isArray(technicalSheetData) ? technicalSheetData[0] : technicalSheetData;

      // Calculate estimated value based on technical sheet cost
      let estimatedValue = 0;
      if (technicalSheet) {
        if (technicalSheet.cost_per_unit) {
          estimatedValue = Number(technicalSheet.cost_per_unit) * quantity;
        } else if (technicalSheet.total_cost && technicalSheet.yield_quantity) {
          const costPerUnit = Number(technicalSheet.total_cost) / Number(technicalSheet.yield_quantity);
          estimatedValue = costPerUnit * quantity;
        }
      }

      // Decrement quantity
      const newQuantity = Number(item.quantity) - quantity;
      if (newQuantity <= 0) {
        await supabaseFetch(`finished_productions_stock?id=eq.${id}`, { method: 'DELETE' });
      } else {
        await supabaseFetch(`finished_productions_stock?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: newQuantity })
        });
      }

      // Record the loss with the technical sheet cost
      await supabaseFetch('losses', {
        method: 'POST',
        body: JSON.stringify({
          user_id: ownerId,
          source_type: 'finished_production',
          source_id: item.technical_sheet_id,
          source_name: item.technical_sheet?.name || 'Produção desconhecida',
          quantity: quantity,
          unit: item.unit,
          estimated_value: estimatedValue,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      toast.success('Perda registrada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Function to deduct from finished stock (used when selling)
  const deductFromStock = async (technicalSheetId: string, quantity: number): Promise<boolean> => {
    const item = finishedStock.find(s => s.technical_sheet_id === technicalSheetId);
    if (!item || Number(item.quantity) < quantity) {
      return false;
    }

    const newQuantity = Number(item.quantity) - quantity;
    if (newQuantity <= 0) {
      await supabaseFetch(`finished_productions_stock?id=eq.${item.id}`, { method: 'DELETE' });
    } else {
      await supabaseFetch(`finished_productions_stock?id=eq.${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: newQuantity })
      });
    }

    return true;
  };

  return {
    finishedStock,
    isLoading,
    isOwnerLoading,
    error,
    addFinishedProduction,
    updateFinishedProduction,
    deleteFinishedProduction,
    deductFromStock,
    registerLoss,
  };
}

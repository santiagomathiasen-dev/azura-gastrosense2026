import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCollaboratorContext } from '@/contexts/CollaboratorContext';

type TableName =
  | 'stock_items'
  | 'technical_sheets'
  | 'productions'
  | 'finished_productions_stock'
  | 'production_stock'
  | 'suppliers'
  | 'stock_movements'
  | 'purchase_list_items'
  | 'sale_products'
  | 'sales'
  | 'technical_sheet_ingredients'
  | 'sale_product_components'
  | 'stock_requests'
  | 'stock_transfers';

interface UseRealtimeOptions {
  tables: TableName[];
}

// Related query keys that cascade on each table update
const CASCADE_MAP: Partial<Record<TableName, string[]>> = {
  stock_items: ['production_stock', 'technical_sheets'],
  technical_sheets: ['productions', 'finished_productions_stock'],
  productions: ['finished_productions_stock', 'stock_items'],
  stock_movements: ['stock_items'],
  technical_sheet_ingredients: ['technical_sheets'],
  sale_product_components: ['sale_products'],
};

/**
 * Hook that subscribes to realtime changes using a SINGLE channel for all tables.
 * This reduces from N WebSocket connections to 1, enabling proper scaling.
 */
export function useRealtimeSubscription({ tables }: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isCollaboratorMode, gestorId } = useCollaboratorContext();

  useEffect(() => {
    if (!user?.id && !isCollaboratorMode) return;

    // One channel handles ALL tables — previously this was N channels
    const channelName = `realtime_global_${user?.id || gestorId || 'collab'}`;
    let channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: [table] });
          CASCADE_MAP[table]?.forEach((related) => {
            queryClient.invalidateQueries({ queryKey: [related] });
          });
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isCollaboratorMode, gestorId, queryClient]);
  // Note: `tables` intentionally omitted from deps — list is stable (defined outside component)
}

const GLOBAL_TABLES: TableName[] = [
  'stock_items',
  'technical_sheets',
  'productions',
  'finished_productions_stock',
  'production_stock',
  'suppliers',
  'stock_movements',
  'purchase_list_items',
  'sale_products',
  'sales',
  'technical_sheet_ingredients',
  'sale_product_components',
  'stock_requests',
  'stock_transfers',
];

/**
 * Preset hook for subscribing to all main data tables via a single WebSocket channel.
 */
export function useGlobalRealtimeSync() {
  useRealtimeSubscription({ tables: GLOBAL_TABLES });
}

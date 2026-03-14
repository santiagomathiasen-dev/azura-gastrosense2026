import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOwnerId } from './useOwnerId';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { supabaseFetch } from '@/lib/supabase-fetch';

type SaleComponentType = Database['public']['Enums']['sale_component_type'];

export interface SaleProductComponent {
  id: string;
  sale_product_id: string;
  component_type: SaleComponentType;
  component_id: string;
  quantity: number;
  unit: string;
  created_at: string;
  component_name?: string;
}

export interface SaleProduct {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sale_price: number | null;
  image_url: string | null;
  is_active: boolean;
  ready_quantity: number;
  minimum_stock: number;
  created_at: string;
  updated_at: string;
  components?: SaleProductComponent[];
}

export interface ComponentInput {
  component_type: SaleComponentType;
  component_id: string;
  quantity: number;
  unit: string;
}

const EMPTY_ARRAY: any[] = [];

export function useSaleProducts() {
  const { user } = useAuth();
  const { ownerId, isLoading: isOwnerLoading } = useOwnerId();
  const queryClient = useQueryClient();

  // Query uses RLS - no need to filter by user_id client-side
  const { data: saleProducts = EMPTY_ARRAY, isLoading, error } = useQuery({
    queryKey: ['sale_products', ownerId],
    queryFn: async () => {
      if (!user?.id && !ownerId) return [];

      try {
        const data = await supabaseFetch('sale_products?select=*,components:sale_product_components(*)&order=name.asc');

        return (data || []).map((p: any) => ({
          ...p,
          minimum_stock: Number(p.minimum_stock || 0),
          sale_price: p.sale_price ? Number(p.sale_price) : null,
        })) as SaleProduct[];
      } catch (err) {
        console.error("Error fetching sale products:", err);
        throw err;
      }
    },
    enabled: (!!user?.id || !!ownerId) && !isOwnerLoading,
  });

  const createSaleProduct = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      sale_price?: number;
      image_url?: string;
      minimum_stock?: number;
      labor_cost?: number;
      energy_cost?: number;
      other_costs?: number;
      components: ComponentInput[];
    }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = await supabaseFetch('sale_products', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          user_id: ownerId,
          name: data.name,
          description: data.description,
          sale_price: data.sale_price,
          image_url: data.image_url,
          minimum_stock: data.minimum_stock || 0,
        })
      });
      const productId = Array.isArray(product) ? product[0].id : product.id;

      if (data.components.length > 0) {
        const componentsToInsert = data.components.map(c => ({
          user_id: ownerId,
          sale_product_id: productId,
          component_type: c.component_type,
          component_id: c.component_id,
          quantity: c.quantity,
          unit: c.unit,
        }));

        await supabaseFetch('sale_product_components', {
          method: 'POST',
          body: JSON.stringify(componentsToInsert)
        });
      }

      return Array.isArray(product) ? product[0] : product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto para venda criado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar produto: ${err.message}`);
    },
  });

  const updateSaleProduct = useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      description?: string;
      sale_price?: number;
      image_url?: string;
      is_active?: boolean;
      minimum_stock?: number;
      labor_cost?: number;
      energy_cost?: number;
      other_costs?: number;
      components?: ComponentInput[];
    }) => {
      const { id, components, ...updates } = data;

      if (Object.keys(updates).length > 0) {
        // Filter out non-existent fields from updates to prevent DB errors
        const {
          labor_cost,
          energy_cost,
          other_costs,
          ...validUpdates
        } = updates as any;

        if (Object.keys(validUpdates).length > 0) {
          await supabaseFetch(`sale_products?id=eq.${id}`, {
            method: 'PATCH',
            body: JSON.stringify(validUpdates)
          });
        }
      }

      if (components !== undefined) {
        await supabaseFetch(`sale_product_components?sale_product_id=eq.${id}`, {
          method: 'DELETE'
        });

        if (components.length > 0) {
          const componentsToInsert = components.map(c => ({
            user_id: ownerId,
            sale_product_id: id,
            component_type: c.component_type,
            component_id: c.component_id,
            quantity: c.quantity,
            unit: c.unit,
          }));

          await supabaseFetch('sale_product_components', {
            method: 'POST',
            body: JSON.stringify(componentsToInsert)
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto atualizado!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar produto: ${err.message}`);
    },
  });

  const deleteSaleProduct = useMutation({
    mutationFn: async (id: string) => {
      await supabaseFetch(`sale_products?id=eq.${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Produto removido!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover produto: ${err.message}`);
    },
  });

  // Prepare product - deduct components from stock and add 1 to ready_quantity
  const prepareSaleProduct = useMutation({
    mutationFn: async ({ sale_product_id, quantity = 1 }: { sale_product_id: string; quantity?: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      const insufficientItems: { id: string; name: string; type: SaleComponentType; amount: number }[] = [];

      // Process each component and deduct from appropriate stock (multiplied by quantity)
      for (const component of product.components || []) {
        const neededTotalQty = Number(component.quantity) * quantity;

        if (component.component_type === 'finished_production') {
          const stockData = await supabaseFetch(`finished_productions_stock?technical_sheet_id=eq.${component.component_id}&select=id,quantity`);
          const stock = Array.isArray(stockData) ? stockData[0] : stockData;

          if (!stock || Number(stock.quantity) < neededTotalQty) {
            const sheetData = await supabaseFetch(`technical_sheets?id=eq.${component.component_id}&select=name`);
            const sheet = Array.isArray(sheetData) ? sheetData[0] : sheetData;

            insufficientItems.push({
              id: component.component_id,
              name: sheet?.name || 'Produção desconhecida',
              type: 'finished_production',
              amount: Math.max(0, neededTotalQty - (Number(stock?.quantity) || 0))
            });
            continue;
          }

          const newQty = Number(stock.quantity) - neededTotalQty;
          if (newQty <= 0) {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, {
              method: 'DELETE'
            });
          } else {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newQty })
            });
          }
        } else if (component.component_type === 'stock_item') {
          const prodStockData = await supabaseFetch(`production_stock?stock_item_id=eq.${component.component_id}&select=id,quantity,stock_item:stock_items(name)`);
          const prodStock = Array.isArray(prodStockData) ? prodStockData[0] : prodStockData;

          if (!prodStock || Number(prodStock.quantity) < neededTotalQty) {
            const stockItemData = await supabaseFetch(`stock_items?id=eq.${component.component_id}&select=name`);
            const stockItem = Array.isArray(stockItemData) ? stockItemData[0] : stockItemData;

            insufficientItems.push({
              id: component.component_id,
              name: stockItem?.name || 'Item desconhecido',
              type: 'stock_item',
              amount: Math.max(0, neededTotalQty - (Number(prodStock?.quantity) || 0))
            });
            continue;
          }

          const newProdQty = Number(prodStock.quantity) - neededTotalQty;
          if (newProdQty <= 0) {
            await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
              method: 'DELETE'
            });
          } else {
            await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newProdQty })
            });
          }
        } else if (component.component_type === 'sale_product') {
          const otherProductData = await supabaseFetch(`sale_products?id=eq.${component.component_id}&select=id,ready_quantity,name`);
          const otherProduct = Array.isArray(otherProductData) ? otherProductData[0] : otherProductData;

          if (!otherProduct || Number(otherProduct.ready_quantity) < neededTotalQty) {
            insufficientItems.push({
              id: component.component_id,
              name: otherProduct?.name || 'Produto desconhecido',
              type: 'sale_product',
              amount: neededTotalQty - (Number(otherProduct?.ready_quantity) || 0)
            });
            continue;
          }

          await supabaseFetch(`sale_products?id=eq.${otherProduct.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ready_quantity: Number(otherProduct.ready_quantity) - neededTotalQty })
          });
        }
      }

      if (insufficientItems.length > 0) {
        // Record alerts in the database
        const alertsToInsert = insufficientItems.map(item => ({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          missing_component_id: item.id,
          missing_component_type: item.type,
          missing_quantity: item.amount,
          resolved: false,
        }));

        await supabaseFetch('preparation_alerts', {
          method: 'POST',
          body: JSON.stringify(alertsToInsert)
        });

        // Invalidate alerts query to update dashboard immediately
        queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });

        const error = new Error(`Estoque insuficiente`);
        (error as any).insufficientItems = insufficientItems;
        throw error;
      }

      // Increment ready_quantity by the full amount
      await supabaseFetch(`sale_products?id=eq.${sale_product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ready_quantity: (product.ready_quantity || 0) + quantity })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      toast.success('Produto preparado! Estoque deduzido.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Quick sale - sell 1 unit from ready_quantity (no stock deduction, already done in prepare)
  const quickSale = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      if ((product.ready_quantity || 0) < 1) {
        throw new Error('Nenhum produto pronto para venda. Prepare primeiro!');
      }

      // Decrement ready_quantity
      await supabaseFetch(`sale_products?id=eq.${sale_product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ready_quantity: product.ready_quantity - 1 })
      });

      // Record the sale
      await supabaseFetch('sales', {
        method: 'POST',
        body: JSON.stringify({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          quantity_sold: 1,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Venda registrada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Return product - add 1 back to ready_quantity (components not restored)
  const returnProduct = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      // Increment ready_quantity (product returns to ready stock)
      await supabaseFetch(`sale_products?id=eq.${sale_product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ready_quantity: (product.ready_quantity || 0) + 1 })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      toast.success('Devolução registrada!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao devolver produto: ${err.message}`);
    },
  });

  // Register loss - remove 1 from ready_quantity without recording as sale
  const registerLoss = useMutation({
    mutationFn: async (sale_product_id: string) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      if ((product.ready_quantity || 0) < 1) {
        throw new Error('Nenhum produto pronto para registrar perda.');
      }

      // Decrement ready_quantity (loss)
      await supabaseFetch(`sale_products?id=eq.${sale_product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ready_quantity: product.ready_quantity - 1 })
      });

      // Record the loss in the losses table
      await supabaseFetch('losses', {
        method: 'POST',
        body: JSON.stringify({
          user_id: ownerId,
          source_type: 'sale_product',
          source_id: sale_product_id,
          source_name: product.name,
          quantity: 1,
          unit: 'unidade',
          estimated_value: product.sale_price || 0,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['losses'] });
      toast.success('Perda registrada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Hot Station Sale - deduct components and immediately record sale (no ready_quantity used)
  const hotStationSale = useMutation({
    mutationFn: async ({ sale_product_id, quantity = 1 }: { sale_product_id: string; quantity?: number }) => {
      if (isOwnerLoading) throw new Error('Carregando dados do usuário...');
      if (!ownerId) throw new Error('Usuário não autenticado');

      const product = saleProducts.find(p => p.id === sale_product_id);
      if (!product) throw new Error('Produto não encontrado');

      const insufficientItems: { id: string; name: string; type: SaleComponentType; amount: number }[] = [];

      // Process each component and deduct from appropriate stock (multiplied by quantity)
      for (const component of product.components || []) {
        const neededTotalQty = Number(component.quantity) * quantity;

        if (component.component_type === 'finished_production') {
          const stockResult = await supabaseFetch(`finished_productions_stock?technical_sheet_id=eq.${component.component_id}&select=id,quantity`);
          const stock = Array.isArray(stockResult) ? stockResult[0] : stockResult;

          if (!stock || Number(stock.quantity) < neededTotalQty) {
            const sheetResult = await supabaseFetch(`technical_sheets?id=eq.${component.component_id}&select=name`);
            const sheet = Array.isArray(sheetResult) ? sheetResult[0] : sheetResult;

            insufficientItems.push({
              id: component.component_id,
              name: sheet?.name || 'Produção desconhecida',
              type: 'finished_production',
              amount: Math.max(0, neededTotalQty - (Number(stock?.quantity) || 0))
            });
            continue;
          }

          const newQty = Number(stock.quantity) - neededTotalQty;
          if (newQty <= 0) {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, { method: 'DELETE' });
          } else {
            await supabaseFetch(`finished_productions_stock?id=eq.${stock.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newQty })
            });
          }
        } else if (component.component_type === 'stock_item') {
          const prodStockResult = await supabaseFetch(`production_stock?stock_item_id=eq.${component.component_id}&select=id,quantity`);
          const prodStock = Array.isArray(prodStockResult) ? prodStockResult[0] : prodStockResult;

          if (!prodStock || Number(prodStock.quantity) < neededTotalQty) {
            const stockItemResult = await supabaseFetch(`stock_items?id=eq.${component.component_id}&select=name`);
            const stockItem = Array.isArray(stockItemResult) ? stockItemResult[0] : stockItemResult;

            insufficientItems.push({
              id: component.component_id,
              name: stockItem?.name || 'Item desconhecido',
              type: 'stock_item',
              amount: Math.max(0, neededTotalQty - (Number(prodStock?.quantity) || 0))
            });
            continue;
          }

          const newProdQty = Number(prodStock.quantity) - neededTotalQty;
          if (newProdQty <= 0) {
            await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, { method: 'DELETE' });
          } else {
            await supabaseFetch(`production_stock?id=eq.${prodStock.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newProdQty })
            });
          }
        } else if (component.component_type === 'sale_product') {
          const otherProductResult = await supabaseFetch(`sale_products?id=eq.${component.component_id}&select=id,ready_quantity,name`);
          const otherProduct = Array.isArray(otherProductResult) ? otherProductResult[0] : otherProductResult;

          if (!otherProduct || Number(otherProduct.ready_quantity) < neededTotalQty) {
            insufficientItems.push({
              id: component.component_id,
              name: otherProduct?.name || 'Produto desconhecido',
              type: 'sale_product',
              amount: Math.max(0, neededTotalQty - (Number(otherProduct?.ready_quantity) || 0))
            });
            continue;
          }

          await supabaseFetch(`sale_products?id=eq.${otherProduct.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ ready_quantity: Number(otherProduct.ready_quantity) - neededTotalQty })
          });
        }
      }

      if (insufficientItems.length > 0) {
        // Record alerts
        const alertsToInsert = insufficientItems.map(item => ({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          missing_component_id: item.id,
          missing_component_type: item.type,
          missing_quantity: item.amount,
          resolved: false,
        }));
        await supabaseFetch('preparation_alerts', {
          method: 'POST',
          body: JSON.stringify(alertsToInsert)
        });
        queryClient.invalidateQueries({ queryKey: ['preparation_alerts'] });

        const error = new Error(`Estoque insuficiente`);
        (error as any).insufficientItems = insufficientItems;
        throw error;
      }

      // Record Sale Directly
      await supabaseFetch('sales', {
        method: 'POST',
        body: JSON.stringify({
          user_id: ownerId,
          sale_product_id: sale_product_id,
          quantity_sold: quantity,
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale_products'] });
      queryClient.invalidateQueries({ queryKey: ['finished_productions_stock'] });
      queryClient.invalidateQueries({ queryKey: ['production_stock'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Produzido e vendido com sucesso (Praça Quente)!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return {
    saleProducts,
    isLoading,
    isOwnerLoading,
    error,
    createSaleProduct,
    updateSaleProduct,
    deleteSaleProduct,
    prepareSaleProduct,
    quickSale,
    returnProduct,
    registerLoss,
    hotStationSale,
  };
}

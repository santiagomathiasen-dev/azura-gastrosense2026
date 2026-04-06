'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDriveData } from '@/contexts/DriveDataContext';
import { useAuth } from '@/hooks/useAuth';
import { supabaseFetch } from '@/lib/supabase-fetch';
import { toast } from 'sonner';
import {
  Cloud, CloudOff, RefreshCw, Upload, Download, Loader2, CheckCircle2, AlertTriangle, HardDrive
} from 'lucide-react';

/**
 * DriveSync component — shows Drive connection status and allows
 * exporting Supabase data to Drive / importing Drive data back.
 * Displayed in the Dashboard or Settings page.
 */
export function DriveSync() {
  const { user } = useAuth();
  const { isDriveConnected, isLoading: driveLoading, isSaving, data, refresh, writeModule } = useDriveData();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExportToDrive = async () => {
    if (!user?.id) return;
    setExporting(true);

    try {
      // Fetch all user data from Supabase
      const [
        stockItems,
        stockMovements,
        technicalSheets,
        productions,
        finishedStock,
        producedInputs,
        saleProducts,
        saleComponents,
        sales,
        salesForecasts,
        forecastOrders,
        suppliers,
        purchaseItems,
        losses,
      ] = await Promise.all([
        supabaseFetch('stock_items?select=*&order=name.asc').catch(() => []),
        supabaseFetch('stock_movements?select=*&order=created_at.desc&limit=500').catch(() => []),
        supabaseFetch('technical_sheets?select=*,technical_sheet_ingredients(*),technical_sheet_stages(*,technical_sheet_stage_steps(*))&order=name.asc').catch(() => []),
        supabaseFetch('productions?select=*&order=created_at.desc&limit=200').catch(() => []),
        supabaseFetch('finished_productions_stock?select=*&order=name.asc').catch(() => []),
        supabaseFetch('produced_inputs_stock?select=*&order=name.asc').catch(() => []),
        supabaseFetch('sale_products?select=*&order=name.asc').catch(() => []),
        supabaseFetch('sale_product_components?select=*').catch(() => []),
        supabaseFetch('sales?select=*&order=created_at.desc&limit=500').catch(() => []),
        supabaseFetch('sales_forecasts?select=*&order=created_at.desc&limit=100').catch(() => []),
        supabaseFetch('forecast_production_orders?select=*&order=created_at.desc&limit=100').catch(() => []),
        supabaseFetch('suppliers?select=*&order=name.asc').catch(() => []),
        supabaseFetch('purchase_list_items?select=*&order=created_at.desc&limit=500').catch(() => []),
        supabaseFetch('losses?select=*&order=created_at.desc&limit=500').catch(() => []),
      ]);

      // Write each module to Drive
      await writeModule('stock', {
        stock_items: stockItems || [],
        stock_movements: stockMovements || [],
      });

      await writeModule('recipes', {
        technical_sheets: technicalSheets || [],
      });

      await writeModule('production', {
        productions: productions || [],
        finished_productions_stock: finishedStock || [],
        produced_inputs_stock: producedInputs || [],
      });

      await writeModule('sales', {
        sale_products: saleProducts || [],
        sale_product_components: saleComponents || [],
        sales: sales || [],
        sales_forecasts: salesForecasts || [],
        forecast_production_orders: forecastOrders || [],
      });

      await writeModule('suppliers', {
        suppliers: suppliers || [],
        purchase_list_items: purchaseItems || [],
      });

      await writeModule('losses', {
        losses: losses || [],
      });

      await writeModule('settings', {
        preferences: {},
        last_sync: new Date().toISOString(),
      });

      toast.success('Dados exportados para o Google Drive com sucesso!');
    } catch (err: any) {
      console.error('Export to Drive failed:', err);
      toast.error('Erro ao exportar: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImportFromDrive = async () => {
    if (!user?.id) return;
    setImporting(true);

    try {
      await refresh();
      toast.success('Dados carregados do Google Drive!');
    } catch (err: any) {
      toast.error('Erro ao importar: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const lastSync = data?.settings?.last_sync
    ? new Date(data.settings.last_sync).toLocaleString('pt-BR')
    : null;

  const stockCount = data?.stock?.stock_items?.length || 0;
  const recipesCount = data?.recipes?.technical_sheets?.length || 0;
  const productionsCount = data?.production?.productions?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="h-5 w-5" />
          Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          {driveLoading ? (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Conectando...
            </Badge>
          ) : isDriveConnected ? (
            <Badge variant="default" className="bg-green-600">
              <Cloud className="h-3 w-3 mr-1" /> Conectado
            </Badge>
          ) : (
            <Badge variant="destructive">
              <CloudOff className="h-3 w-3 mr-1" /> Desconectado
            </Badge>
          )}
          {lastSync && (
            <span className="text-[10px] text-muted-foreground">
              Sincronizado: {lastSync}
            </span>
          )}
        </div>

        {/* Data summary */}
        {isDriveConnected && data && (
          <div className="flex gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="font-medium">{stockCount}</span>
              <span className="text-muted-foreground">itens estoque</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{recipesCount}</span>
              <span className="text-muted-foreground">fichas</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{productionsCount}</span>
              <span className="text-muted-foreground">producoes</span>
            </div>
          </div>
        )}

        {/* Actions */}
        {isDriveConnected && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1 text-xs"
              onClick={handleExportToDrive}
              disabled={exporting || isSaving}
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              Exportar para Drive
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={handleImportFromDrive}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              Carregar do Drive
            </Button>
          </div>
        )}

        {!isDriveConnected && !driveLoading && (
          <p className="text-xs text-muted-foreground">
            Para conectar, faca login com Google na pagina de autenticacao.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

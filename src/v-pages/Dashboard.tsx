'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, Calendar, Clock, Bot, XCircle, CheckCircle2, Sparkles, ShoppingCart, TrendingUp, ChefHat, CalendarClock, BarChart3, Package, ClipboardList, ArrowUpRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProductions } from '@/hooks/useProductions';
import { useStockItems } from '@/hooks/useStockItems';
import { useFinishedProductionsStock } from '@/hooks/useFinishedProductionsStock';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { usePendingDeliveries } from '@/hooks/usePendingDeliveries';
import { usePreparationAlerts } from '@/hooks/usePreparationAlerts';
import { usePurchaseCalculationByPeriod } from '@/hooks/usePurchaseCalculationByPeriod';
import { useMemo } from 'react';
import { getTodayStr, cn, getNow } from '@/lib/utils';
import { useAllExpiryAlerts, parseSafeDate, useEarliestExpiryMap } from '@/hooks/useExpiryDates';
import { useStockMovements } from '@/hooks/useStockMovements';
import { DriveSync } from '@/components/DriveSync';

export default function Dashboard() {
  const router = useRouter();
  const navigate = (p: string) => router.push(p);
  const { productions, isLoading: productionsLoading } = useProductions();
  const { items: stockItems, isLoading: stockLoading } = useStockItems();
  const { finishedStock, isLoading: finishedLoading } = useFinishedProductionsStock();
  const { saleProducts, isLoading: saleProductsLoading } = useSaleProducts();
  const { alerts: preparationAlerts, isLoading: alertsLoading, resolveAlert } = usePreparationAlerts();
  const { pendingItems } = usePendingDeliveries();
  const { totalEstimatedCost, urgentCount } = usePurchaseCalculationByPeriod({ productions });
  const { alerts: expiryAlerts, totalAlerts: totalExpiryAlerts, expiredCount, nearExpiryCount, isLoading: expiryLoading } = useAllExpiryAlerts(7);
  const { expiryMap } = useEarliestExpiryMap();

  const plannedProductions = productions.filter((p) => p.status === 'planned');
  const inProgressProductions = productions.filter((p) => p.status === 'in_progress');

  const lowStockItems = stockItems.filter(
    (item) => {
      const isExpired = Number(item.current_quantity) > 0 && expiryMap[item.id] && parseSafeDate(expiryMap[item.id]) < getNow();
      return (item.current_quantity <= item.minimum_quantity || isExpired) &&
        !pendingItems.some(p => p.stock_item_id === item.id);
    }
  );
  const lowFinishedStock = finishedStock.filter((item) => {
    const incoming = inProgressProductions
      .filter(p => p.technical_sheet_id === item.technical_sheet_id)
      .reduce((sum, p) => sum + (Number(p.planned_quantity) || 0), 0);
    return (item.quantity + incoming) <= (item.technical_sheet?.minimum_stock || 0);
  });
  const lowSaleProducts = saleProducts.filter(
    (item) => item.ready_quantity <= (item.minimum_stock || 0)
  );

  const combinedAlerts = [
    ...lowStockItems.map(item => ({ id: item.id, name: item.name, current: item.current_quantity, min: item.minimum_quantity, unit: item.unit, type: 'insumo' as const })),
    ...lowFinishedStock.map(item => ({ id: item.id, name: item.technical_sheet?.name || 'Desconhecido', current: item.quantity, min: item.technical_sheet?.minimum_stock || 0, unit: item.unit, type: 'producao' as const })),
    ...lowSaleProducts.map(item => ({ id: item.id, name: item.name, current: item.ready_quantity, min: item.minimum_stock || 0, unit: 'un', type: 'venda' as const }))
  ];

  const groupedPrepAlerts = useMemo(() => {
    const map = new Map<string, { name: string; productNames: string[]; totalMissing: number; ids: string[] }>();
    for (const alert of preparationAlerts) {
      const key = alert.missing_component_name || 'Desconhecido';
      const productName = alert.sale_product?.name || 'Produto';
      const existing = map.get(key);
      if (existing) {
        existing.totalMissing += Number(alert.missing_quantity) || 0;
        if (!existing.productNames.includes(productName)) existing.productNames.push(productName);
        existing.ids.push(alert.id);
      } else {
        map.set(key, { name: key, productNames: [productName], totalMissing: Number(alert.missing_quantity) || 0, ids: [alert.id] });
      }
    }
    return Array.from(map.values());
  }, [preparationAlerts]);

  const insights = useMemo(() => {
    const list: { icon: any; text: string; type: 'info' | 'warning' | 'success' }[] = [];
    const productsToPrepare = saleProducts.filter(p => (p.minimum_stock || 0) > (p.ready_quantity || 0));
    if (productsToPrepare.length > 0) {
      const top = productsToPrepare[0];
      list.push({ icon: ChefHat, text: `Estoque de "${top.name}" baixo. Prepare pelo menos ${(top.minimum_stock || 0) - (top.ready_quantity || 0)} un.`, type: 'warning' });
    }
    if (urgentCount > 0) list.push({ icon: ShoppingCart, text: `${urgentCount} insumos em estado crítico. Garanta a compra urgente.`, type: 'warning' });
    if (totalEstimatedCost > 1000) list.push({ icon: TrendingUp, text: `Investimento estimado: R$ ${totalEstimatedCost.toFixed(2)}. Atenção ao fluxo de caixa.`, type: 'info' });
    const todayStr = getTodayStr();
    const todayProductions = productions.filter(p => p.scheduled_date?.startsWith(todayStr) && p.status === 'planned');
    if (todayProductions.length > 0) list.push({ icon: Sparkles, text: `${todayProductions.length} produções planejadas para hoje. Comece pelas mais complexas!`, type: 'success' });
    if (list.length === 0) list.push({ icon: Bot, text: "Tudo sob controle! Estoque e produções dentro dos parâmetros.", type: 'success' });
    return list.slice(0, 4);
  }, [productions, saleProducts, urgentCount, totalEstimatedCost]);

  const totalAlerts = combinedAlerts.length;
  const isLoadingAlerts = stockLoading || finishedLoading || saleProductsLoading || expiryLoading;
  const cardClass = "flex flex-col min-h-[200px]";
  const cardContentClass = "flex-1 overflow-auto space-y-2";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Painel" description="Visão geral da sua gestão gastronômica" />

      <div className="space-y-4">
        {/* Alerta Crítico de Validade */}
        {totalExpiryAlerts > 0 && (
          <div
            className={cn(
              "p-3 rounded-lg border flex items-center justify-between animate-pulse cursor-pointer",
              expiredCount > 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-warning/10 border-warning/30 text-warning-foreground"
            )}
            onClick={() => navigate('/estoque')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                expiredCount > 0 ? "bg-destructive/20" : "bg-warning/20"
              )}>
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  {expiredCount > 0
                    ? `${expiredCount} itens VENCIDOS!`
                    : `${nearExpiryCount} itens vencendo em breve`}
                </p>
                <p className="text-xs opacity-90">Verifique o estoque para evitar desperdícios.</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-8 font-bold">Ver Itens</Button>
          </div>
        )}
        {/* Row 1: Assistente - Full Width */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <Bot className="h-4 w-4" />
              Assistente
              <Badge variant="outline" className="ml-auto text-[10px] animate-pulse bg-primary/10 text-primary border-primary/20">
                Análise em tempo real
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {insights.map((insight, index) => (
                <div key={index} className="flex gap-2 items-start p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className={`mt-0.5 p-1 rounded-full shrink-0 ${insight.type === 'warning' ? 'bg-orange-100 text-orange-600' : insight.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    <insight.icon className="h-3 w-3" />
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">{insight.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Falhas de Preparação + Alertas de Estoque */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={`${cardClass} ${groupedPrepAlerts.length > 0 ? 'border-destructive/30 bg-destructive/5' : ''} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate('/producao')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                Falhas na Preparação
                {groupedPrepAlerts.length > 0 && <Badge variant="destructive" className="ml-auto text-[10px] h-5">{groupedPrepAlerts.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentClass}>
              {alertsLoading ? <p className="text-xs text-muted-foreground">Carregando...</p>
                : groupedPrepAlerts.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma falha registrada ✅</p>
                  : groupedPrepAlerts.map((group) => (
                    <div key={group.name} className="flex items-center justify-between p-2 rounded-lg bg-background border border-destructive/20">
                      <div className="flex-1 min-w-0 mr-1">
                        <p className="font-medium text-xs truncate">Faltou: <span className="text-destructive">{group.name}</span></p>
                        <p className="text-[10px] text-muted-foreground truncate">{group.productNames.join(', ')}</p>
                        <p className="text-[10px] text-muted-foreground">Total faltante: {group.totalMissing}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); group.ids.forEach(id => resolveAlert.mutate(id)); }} className="p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-green-600 transition-colors shrink-0" title="Resolver todos">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
            </CardContent>
          </Card>

          <Card className={`${cardClass} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate('/estoque')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alertas de Estoque
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">{totalAlerts}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentClass}>
              {isLoadingAlerts ? <p className="text-xs text-muted-foreground">Carregando...</p>
                : totalAlerts === 0 ? <p className="text-xs text-muted-foreground">Nenhum alerta de estoque ✅</p>
                  : combinedAlerts.slice(0, 6).map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/20 hover:bg-warning/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); if (item.type === 'insumo') navigate('/estoque'); else if (item.type === 'producao') navigate('/estoque-finalizados'); else navigate('/produtos-venda'); }}>
                      <div className="flex-1 min-w-0 mr-1">
                        <div className="flex items-center gap-1">
                          <p className="font-medium text-xs truncate">{item.name}</p>
                          <Badge variant="outline" className="text-[8px] h-3 px-1 uppercase shrink-0">{item.type === 'insumo' ? 'Ins' : item.type === 'producao' ? 'Prod' : 'Venda'}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Mín: {item.min} {item.unit}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-warning border-warning shrink-0">{item.current} {item.unit}</Badge>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Em Processo + Programadas + Validade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={`${cardClass} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate('/producao')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-success" />
                Em Processo
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">{inProgressProductions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentClass}>
              {productionsLoading ? <p className="text-xs text-muted-foreground">Carregando...</p>
                : inProgressProductions.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma produção em andamento</p>
                  : inProgressProductions.slice(0, 5).map((prod) => (
                    <div key={prod.id} className="flex items-center justify-between p-2 rounded-lg bg-success/10 border border-success/20">
                      <div className="min-w-0 mr-1">
                        <p className="font-medium text-xs truncate">{prod.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(prod.scheduled_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-success border-success shrink-0">{prod.planned_quantity} un</Badge>
                    </div>
                  ))}
            </CardContent>
          </Card>

          <Card className={`${cardClass} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => navigate('/producao')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Programadas
                <Badge variant="secondary" className="ml-auto text-[10px] h-5">{plannedProductions.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentClass}>
              {productionsLoading ? <p className="text-xs text-muted-foreground">Carregando...</p>
                : plannedProductions.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma produção programada</p>
                  : plannedProductions.slice(0, 5).map((prod) => (
                    <div key={prod.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="min-w-0 mr-1">
                        <p className="font-medium text-xs truncate">{prod.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(prod.scheduled_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{prod.planned_quantity} un</Badge>
                    </div>
                  ))}
            </CardContent>
          </Card>

          {/* Alertas de Validade */}
          <Card className={`${cardClass} cursor-pointer hover:shadow-md transition-shadow ${expiredCount > 0 ? 'border-destructive/30 bg-destructive/5' : nearExpiryCount > 0 ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`} onClick={() => navigate('/estoque')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-orange-500" />
                Validades
                {totalExpiryAlerts > 0 && (
                  <Badge variant={expiredCount > 0 ? 'destructive' : 'secondary'} className="ml-auto text-[10px] h-5">
                    {totalExpiryAlerts}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className={cardContentClass}>
              {expiryLoading ? <p className="text-xs text-muted-foreground">Carregando...</p>
                : totalExpiryAlerts === 0 ? <p className="text-xs text-muted-foreground">Nenhum alerta de validade ✅</p>
                  : expiryAlerts.slice(0, 6).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-2 rounded-lg border ${alert.isExpired ? 'bg-destructive/10 border-destructive/20' : 'bg-yellow-500/5 border-yellow-500/20'
                        }`}
                    >
                      <div className="flex-1 min-w-0 mr-1">
                        <p className="font-medium text-xs truncate">
                          {(alert as any).stock_item?.name || 'Item'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {parseSafeDate(alert.expiry_date).toLocaleDateString('pt-BR')}
                          {alert.batch_name && ` • Lote: ${alert.batch_name}`}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${alert.isExpired ? 'text-destructive border-destructive' : 'text-yellow-600 border-yellow-500'
                          }`}
                      >
                        {alert.isExpired ? 'Vencido' : `${alert.daysUntil}d`}
                      </Badge>
                    </div>
                  ))}
            </CardContent>
          </Card>
        </div>

        {/* Google Drive Sync */}
        <DriveSync />
      </div>
    </div>
  );
}

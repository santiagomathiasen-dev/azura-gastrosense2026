import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  DollarSign,
  TrendingDown,
  Package,
  ShoppingCart,
  Calendar as CalendarIcon,
  Download,
  Printer,
  Calculator,
  Info,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { useReports, DateRangeType } from '@/hooks/useReports';
import { useProductCosts } from '@/hooks/useProductCosts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, getNow, formatInBrasilia } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';

function DatePickerWithState({ date, setDate, placeholder }: { date: Date | undefined, setDate: (d: Date | undefined) => void, placeholder: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-[130px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd/MM/yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            if (selectedDate) {
              // Adjust time to 12:00 to avoid timezone rollback issues (UTC vs Local)
              selectedDate.setHours(12, 0, 0, 0);
            }
            setDate(selectedDate);
            setOpen(false);
          }}
          initialFocus
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function Relatorios() {
  const [dateRange, setDateRange] = useState<DateRangeType>('today');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [activeTab, setActiveTab] = useState('vendas');

  const {
    salesReport,
    lossesReport,
    purchasedReport,
    usedReport,
    purchaseListReport,
    movementsReport,
    totalSales,
    totalLosses,
    totalPurchased,
    totalPurchaseList,
    alerts,
    isLoading,
  } = useReports(dateRange, customStart, customEnd);

  const { productCosts, isLoading: isCostsLoading } = useProductCosts();

  const handleExport = (reportType: string) => {
    let data: any[] = [];
    let filename = '';
    let headers: string[] = [];

    switch (reportType) {
      case 'vendas':
        data = salesReport;
        filename = 'relatorio_vendas';
        headers = ['Data', 'Produto', 'Quantidade', 'Preço Unitário', 'Total'];
        break;
      case 'perdas':
        data = lossesReport;
        filename = 'relatorio_perdas';
        headers = ['Data', 'Produto', 'Quantidade', 'Valor Estimado'];
        break;
      case 'comprados':
        data = purchasedReport;
        filename = 'relatorio_insumos_comprados';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Fornecedor', 'Custo Total'];
        break;
      case 'utilizados':
        data = usedReport;
        filename = 'relatorio_insumos_utilizados';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Produção', 'Origem'];
        break;
      case 'compras':
        data = purchaseListReport;
        filename = 'relatorio_compras';
        headers = ['Data', 'Item', 'Quantidade', 'Unidade', 'Fornecedor', 'Status', 'Custo Estimado'];
        break;
      case 'movements':
        data = movementsReport;
        filename = 'relatorio_movimentacoes_estoque';
        headers = ['Data', 'Item', 'Tipo', 'Quantidade', 'Unidade', 'Justificativa', 'Origem'];
        break;
    }

    // Escape CSV values to prevent formula injection attacks
    const escapeCsv = (v: unknown) => {
      const s = String(v ?? '');
      const dangerous = /^[=+\-@\t\r]/.test(s);
      const clean = dangerous ? `'${s}` : s;
      const needsQuote = clean.includes(';') || clean.includes('"') || clean.includes('\n');
      return needsQuote ? `"${clean.replace(/"/g, '""')}"` : clean;
    };

    // Convert to CSV
    const csvContent = [
      headers.join(';'),
      ...data.map(row => Object.values(row).map(escapeCsv).join(';'))
    ].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${filename}_${formatInBrasilia(getNow(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportFinances = () => {
    const headers = ['Produto', 'CMV (Custo Insumos)', 'Preço Sugerido (CMV 30%)', 'Preço Atual', 'Margem Bruta (%)'];
    const data = productCosts.map(p => [
      p.name,
      p.totalCost.toFixed(2),
      p.suggestedSalePrice.toFixed(2),
      p.currentSalePrice?.toFixed(2) || '0.00',
      p.margin.toFixed(1)
    ]);

    const escapeCsvFin = (v: unknown) => {
      const s = String(v ?? '');
      const dangerous = /^[=+\-@\t\r]/.test(s);
      const clean = dangerous ? `'${s}` : s;
      const needsQuote = clean.includes(';') || clean.includes('"') || clean.includes('\n');
      return needsQuote ? `"${clean.replace(/"/g, '""')}"` : clean;
    };

    const csvContent = [
      headers.join(';'),
      ...data.map(row => row.map(escapeCsvFin).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const finUrl = URL.createObjectURL(blob);
    link.href = finUrl;
    link.download = `planilha_financeira_${formatInBrasilia(getNow(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(finUrl);
  };

  if (isLoading || isCostsLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Relatórios" description="Relatórios e análises do sistema" />
        <div className="grid grid-cols-4 gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-6">
      {/* Printable Header - Only visible on print */}
      <div className="hidden print:block border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider">Azura GastroSense</h1>
            <p className="text-sm font-medium">Gestão Inteligente para Gastronomia</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{activeTab.toUpperCase()} - RELATÓRIO</p>
            <p className="text-xs text-muted-foreground">Gerado em: {formatInBrasilia(getNow(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-dashed border-gray-300">
          <p className="text-sm">
            <span className="font-bold">Período:</span> {
              dateRange === 'today' ? 'Hoje' :
              dateRange === 'week' ? 'Esta Semana' :
              dateRange === 'month' ? 'Este Mês' :
              `${formatInBrasilia(customStart || getNow(), 'dd/MM/yyyy')} até ${formatInBrasilia(customEnd || getNow(), 'dd/MM/yyyy')}`
            }
          </p>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          title="Relatórios"
          description="Relatórios e análises do sistema"
        />
      </div>

      {/* Alerts Section */}
      {alerts && (alerts as any[]).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 print:hidden">
          {(alerts as any[]).map((alert, idx) => (
            <Card key={idx} className={cn(
              "border-l-4",
              alert.severity === 'error' ? "border-l-destructive bg-destructive/5" :
                alert.severity === 'warning' ? "border-l-amber-500 bg-amber-50" : "border-l-blue-500 bg-blue-50"
            )}>
              <div className="px-3 py-2 flex items-start gap-3">
                <div className="shrink-0 mt-1">
                  {alert.severity === 'error' ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                    alert.severity === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-600" /> :
                      <TrendingUp className="h-4 w-4 text-blue-600" />}
                </div>
                <div>
                  <p className="font-bold text-[13px] leading-tight">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Date Range Selector */}
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mês</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <DatePickerWithState
              date={customStart}
              setDate={setCustomStart}
              placeholder="Data inicial"
            />
            <span className="text-muted-foreground">até</span>
            <DatePickerWithState
              date={customEnd}
              setDate={setCustomEnd}
              placeholder="Data final"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 print:grid-cols-4">
        <Card className="print:border print:border-gray-200">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-emerald-600 mx-auto mb-1 print:hidden" />
            <p className="text-lg font-bold text-emerald-600 print:text-black">R$ {(totalSales || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Vendas</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5 print:bg-white print:border-gray-200">
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-5 w-5 text-destructive mx-auto mb-1 print:hidden" />
            <p className="text-lg font-bold text-destructive print:text-black">R$ {(totalLosses || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Perdas</p>
          </CardContent>
        </Card>
        <Card className="print:border print:border-gray-200">
          <CardContent className="p-3 text-center">
            <Package className="h-5 w-5 text-primary mx-auto mb-1 print:hidden" />
            <p className="text-lg font-bold">R$ {(totalPurchased || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Insumos Comprados</p>
          </CardContent>
        </Card>
        <Card className="print:border print:border-gray-200">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="h-5 w-5 text-orange-500 mx-auto mb-1 print:hidden" />
            <p className="text-lg font-bold">R$ {(totalPurchaseList || 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Lista Compras</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-2 print:hidden">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">Fluxo Financeiro (Vendas vs Perdas)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { name: 'Vendas', valor: totalSales || 0 },
                  { name: 'Perdas', valor: totalLosses || 0 }
                ]}
                margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="valor" stroke="#059669" fill="#059669" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">Top 5 Insumos Comprados (Custo)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={purchasedReport.slice(0, 5).map(i => ({
                  name: i.itemName.length > 12 ? i.itemName.substring(0, 10) + '...' : i.itemName,
                  valor: i.totalCost
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.2} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={11} width={100} tickLine={false} axisLine={false} />
                <RechartsTooltip />
                <Bar dataKey="valor" fill="#1b5e3f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="vendas" className="text-xs">Vendas</TabsTrigger>
            <TabsTrigger value="perdas" className="text-xs">Perdas</TabsTrigger>
            <TabsTrigger value="comprados" className="text-xs">Insumos Comprados</TabsTrigger>
            <TabsTrigger value="utilizados" className="text-xs">Insumos Utilizados</TabsTrigger>
            <TabsTrigger value="compras" className="text-xs">Compras</TabsTrigger>
            <TabsTrigger value="movements" className="text-xs font-bold bg-primary/10">Movimentações Estoque</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport(activeTab)}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </div>

        {/* Sales Report */}
        <TabsContent value="vendas">
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="pb-2 print:hidden">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Relatório de Vendas
                <Badge variant="secondary">{salesReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma venda no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.map((sale, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{sale.date}</TableCell>
                          <TableCell className="font-medium">{sale.productName}</TableCell>
                          <TableCell className="text-right">{sale.quantity}</TableCell>
                          <TableCell className="text-right">R$ {(sale.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">R$ {(sale.total || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={2}>TOTAL</TableCell>
                        <TableCell className="text-right">{salesReport.reduce((sum, s) => sum + (s.quantity || 0), 0)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-emerald-600">R$ {(totalSales || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Losses Report */}
        <TabsContent value="perdas">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Relatório de Perdas
                <Badge variant="destructive">{lossesReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossesReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma perda registrada no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead className="text-right">Valor Est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lossesReport.map((loss, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{loss.date}</TableCell>
                          <TableCell className="font-medium">{loss.productName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {loss.sourceType === 'sale_product' ? 'Venda' :
                                loss.sourceType === 'finished_production' ? 'Produção' : 'Estoque'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{loss.quantity}</TableCell>
                          <TableCell>{loss.unit}</TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            R$ {(loss.estimatedValue || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-destructive/10 font-bold border-t-2">
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        <TableCell className="text-right">{lossesReport.reduce((sum, l) => sum + (l.quantity || 0), 0)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right text-destructive">R$ {(totalLosses || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchased Ingredients Report */}
        <TabsContent value="comprados">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Insumos Comprados
                <Badge variant="secondary">{purchasedReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchasedReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum insumo comprado no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchasedReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.supplierName || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {(item.totalCost || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={5}>TOTAL</TableCell>
                        <TableCell className="text-right text-primary">R$ {(totalPurchased || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Used Ingredients Report */}
        <TabsContent value="utilizados">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Insumos Utilizados
                <Badge variant="secondary">{usedReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usedReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum insumo utilizado no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Produção</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usedReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-xs">{item.productionName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{item.source}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={2}>TOTAL DE ITENS</TableCell>
                        <TableCell className="text-right">{(usedReport.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0).toFixed(2)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Purchases Report */}
        <TabsContent value="compras">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Relatório de Compras
                <Badge variant="secondary">{purchaseListReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {purchaseListReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma compra no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Unid.</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Custo Est.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseListReport.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{item.date}</TableCell>
                          <TableCell className="font-medium">{item.itemName}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.supplierName || '-'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === 'Entregue' ? 'default' : item.status === 'Comprado' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            R$ {(item.estimatedCost || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Summary Row */}
                      <TableRow className="bg-muted/50 font-bold border-t-2">
                        <TableCell colSpan={6}>TOTAL</TableCell>
                        <TableCell className="text-right text-orange-600">R$ {(totalPurchaseList || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movements Report */}
        <TabsContent value="movements">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Histórico Geral de Movimentações
                <Badge variant="secondary">{movementsReport.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementsReport.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma movimentação no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead>Justificativa/Notas</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movementsReport.map((mov, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm whitespace-nowrap">{mov.date}</TableCell>
                          <TableCell className="font-medium">{mov.itemName}</TableCell>
                          <TableCell>
                            <Badge variant={mov.type === 'entry' ? 'default' : 'destructive'} className={mov.type === 'entry' ? 'bg-emerald-100 text-emerald-700' : ''}>
                              {mov.type === 'entry' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {mov.type === 'entry' ? '+' : '-'}{mov.quantity} {mov.unit}
                          </TableCell>
                          <TableCell className="text-xs italic text-muted-foreground">{mov.notes || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{mov.source}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

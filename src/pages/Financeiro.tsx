import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Calculator,
    Info,
    DollarSign,
    TrendingUp,
    ArrowUpRight,
    Save,
    Check,
    Factory,
    Zap,
    PackagePlus,
    Edit,
    FileText,
    Users,
    Plus,
    Upload,
    Receipt,
    Wallet
} from 'lucide-react';
import { useProductCosts } from '@/hooks/useProductCosts';
import { useSaleProducts } from '@/hooks/useSaleProducts';
import { useFinancials, FinancialExpense, PayrollEntry } from '@/hooks/useFinancials';
import { useCollaborators } from '@/hooks/useCollaborators';
import { cn, getNow } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

export default function Financeiro() {
    const { productCosts, isLoading: isCostsLoading } = useProductCosts();
    const { updateSaleProduct } = useSaleProducts();
    const { expenses, payroll, addExpense, addPayroll, isLoading: isFinancialsLoading } = useFinancials();
    const { collaborators } = useCollaborators();

    const [activeTab, setActiveTab] = useState('precificacao');
    const [targetCMV, setTargetCMV] = useState(30);

    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [editValues, setEditValues] = useState({
        labor: '0',
        energy: '0',
        other: '0'
    });

    // Mock data for charts if no real expenses exist
    const chartData = useMemo(() => {
        if (expenses.length > 0) {
            // Group by category
            return [
                { name: 'Fixos', valor: expenses.filter(e => e.category === 'fixed').reduce((a, b) => a + b.amount, 0) },
                { name: 'Variáveis', valor: expenses.filter(e => e.category === 'variable').reduce((a, b) => a + b.amount, 0) },
                { name: 'Folha', valor: payroll.reduce((a, b) => a + b.amount, 0) }
            ];
        }
        return [
            { name: 'Fixos', valor: 2500, color: '#1b5e3f' },
            { name: 'Variáveis', valor: 4200, color: '#f59e0b' },
            { name: 'Folha', valor: 8500, color: '#10b981' }
        ];
    }, [expenses, payroll]);

    const handleApplyPrice = (productId: string, price: number) => {
        updateSaleProduct.mutate({
            id: productId,
            sale_price: Number(price.toFixed(2))
        }, {
            onSuccess: () => {
                toast.success('Preço atualizado com sucesso!');
            }
        });
    };

    const [showExpenseDialog, setShowExpenseDialog] = useState(false);
    const [showPayrollDialog, setShowPayrollDialog] = useState(false);
    const [newExpense, setNewExpense] = useState<Omit<FinancialExpense, 'id'>>({
        description: '',
        amount: 0,
        category: 'fixed',
        type: 'other',
        date: getNow().toISOString().split('T')[0],
        status: 'pending',
        invoice_number: '',
        document_url: ''
    });

    const [newPayroll, setNewPayroll] = useState<Omit<PayrollEntry, 'id'>>({
        collaborator_id: '',
        collaborator_name: '',
        amount: 0,
        type: 'salary',
        date: getNow().toISOString().split('T')[0],
        status: 'pending',
        payslip_data: {
            base_salary: 0,
            overtime: 0,
            bonuses: 0,
            deductions: 0,
            net_salary: 0
        }
    });

    const handleAddExpense = () => {
        if (!newExpense.description || newExpense.amount <= 0) {
            toast.error('Preencha a descrição e o valor corretamente.');
            return;
        }
        addExpense.mutate(newExpense, {
            onSuccess: () => {
                setShowExpenseDialog(false);
                setNewExpense({
                    description: '',
                    amount: 0,
                    category: 'fixed',
                    type: 'other',
                    date: getNow().toISOString().split('T')[0],
                    status: 'pending',
                    invoice_number: '',
                    document_url: ''
                });
            }
        });
    };

    const handleAddPayroll = () => {
        if (!newPayroll.collaborator_id || newPayroll.amount <= 0) {
            toast.error('Selecione um colaborador e informe o valor.');
            return;
        }

        // Auto-calculate net if payslip active
        const net = (newPayroll.payslip_data?.base_salary || 0) +
            (newPayroll.payslip_data?.overtime || 0) +
            (newPayroll.payslip_data?.bonuses || 0) -
            (newPayroll.payslip_data?.deductions || 0);

        const entry = {
            ...newPayroll,
            amount: net > 0 ? net : newPayroll.amount
        };

        addPayroll.mutate(entry, {
            onSuccess: () => {
                setShowPayrollDialog(false);
                setNewPayroll({
                    collaborator_id: '',
                    collaborator_name: '',
                    amount: 0,
                    type: 'salary',
                    date: getNow().toISOString().split('T')[0],
                    status: 'pending',
                    payslip_data: {
                        base_salary: 0,
                        overtime: 0,
                        bonuses: 0,
                        deductions: 0,
                        net_salary: 0
                    }
                });
            }
        });
    };

    const handleOpenEdit = (product: any) => {
        setEditingProduct(product);
        setEditValues({
            labor: (product.laborCost || 0).toString(),
            energy: (product.energyCost || 0).toString(),
            other: (product.otherCosts || 0).toString()
        });
    };

    if (isCostsLoading || isFinancialsLoading) {
        return (
            <div className="space-y-4">
                <PageHeader title="Financeiro" description="Gestão de custos e precificação" />
                <Skeleton className="h-[200px] w-full" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-8">
            <PageHeader
                title="Financeiro"
                description="Gestão financeira, precificação e folha de pagamento"
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="precificacao" className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Precificação
                    </TabsTrigger>
                    <TabsTrigger value="gastos" className="flex items-center gap-2">
                        <Receipt className="h-4 w-4" />
                        Gastos & Notas
                    </TabsTrigger>
                    <TabsTrigger value="folha" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        RH & Folha
                    </TabsTrigger>
                </TabsList>

                {/* --- TAB: PRECIFICAÇÃO --- */}
                <TabsContent value="precificacao" className="space-y-4">
                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Calculator className="h-5 w-5 text-primary" />
                                        Simulador de Precificação (Markup)
                                    </CardTitle>
                                    <CardDescription>Ajuste o CMV alvo para recalcular os preços sugeridos</CardDescription>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-primary">{targetCMV}%</span>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">CMV ALVO</p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="px-2">
                                <Slider
                                    value={[targetCMV]}
                                    onValueChange={(vals) => setTargetCMV(vals[0])}
                                    min={15}
                                    max={60}
                                    step={1}
                                    className="py-4"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                                    <span>MARGEM ALTA (15%)</span>
                                    <span>EQUILIBRADO (30-35%)</span>
                                    <span>VOLUME (60%)</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="p-3 bg-background rounded-xl border shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Meta Gastos</p>
                                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                                    </div>
                                    <p className="text-xl font-bold text-emerald-600">{100 - targetCMV}%</p>
                                    <p className="text-[10px] text-muted-foreground italic">Margem Bruta Disponível</p>
                                </div>

                                <div className="p-3 bg-background rounded-xl border shadow-sm">
                                    <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Markup (K)</p>
                                    <p className="text-xl font-bold text-blue-600">{(100 / targetCMV).toFixed(2)}x</p>
                                    <p className="text-[10px] text-muted-foreground italic">Multiplicador do custo</p>
                                </div>

                                <div className="p-3 bg-background rounded-xl border shadow-sm lg:col-span-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Info className="h-3 w-3 text-primary" />
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Composição Estimada (Base 100%)</p>
                                    </div>
                                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted mt-2">
                                        <div style={{ width: `${targetCMV}%` }} className="bg-primary" title="CMV" />
                                        <div style={{ width: '15%' }} className="bg-emerald-500" title="Impostos" />
                                        <div style={{ width: '25%' }} className="bg-blue-500" title="Custos Fixos" />
                                        <div style={{ width: `${Math.max(0, 100 - targetCMV - 40)}%` }} className="bg-orange-500" title="Lucro Líquido" />
                                    </div>
                                    <div className="flex gap-3 mt-2">
                                        <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> CMV {targetCMV}%</span>
                                        <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Imp. 15%</span>
                                        <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Fixo 25%</span>
                                        <span className="flex items-center gap-1 text-[9px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Lucro {Math.max(0, 60 - targetCMV)}%</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Análise de Produtos e Precificação Sugerida
                                <Badge variant="secondary" className="ml-auto">{productCosts.length} produtos</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Produto</TableHead>
                                            <TableHead className="text-right">Custo Total</TableHead>
                                            <TableHead className="text-right">Preço Sugerido</TableHead>
                                            <TableHead className="text-right">Preço Atual</TableHead>
                                            <TableHead className="text-right">Margem Atual</TableHead>
                                            <TableHead className="text-right">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {productCosts.map((p) => {
                                            const dynamicSuggested = p.totalCost / (targetCMV / 100);
                                            const isPriceDifferent = Math.abs(dynamicSuggested - (p.currentSalePrice || 0)) > 0.01;
                                            const currentMargin = p.currentSalePrice && p.currentSalePrice > 0
                                                ? ((p.currentSalePrice - p.totalCost) / p.currentSalePrice) * 100
                                                : 0;

                                            return (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-bold">
                                                        <div className="flex flex-col">
                                                            <span>{p.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">Custo Insumos: R${p.ingredientCost.toFixed(2)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-black">
                                                        R$ {p.totalCost.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-black text-primary">R$ {dynamicSuggested.toFixed(2)}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-muted-foreground">
                                                        R$ {p.currentSalePrice?.toFixed(2) || '0.00'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge
                                                            className={cn(currentMargin >= (100 - targetCMV) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-destructive/10 text-destructive border-destructive/20")}
                                                        >
                                                            {currentMargin.toFixed(1)}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant={isPriceDifferent ? "default" : "outline"}
                                                            disabled={!isPriceDifferent}
                                                            onClick={() => handleApplyPrice(p.id, dynamicSuggested)}
                                                            className="h-8 gap-1.5"
                                                        >
                                                            {isPriceDifferent ? <ArrowUpRight className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                                            {isPriceDifferent ? 'Aplicar' : 'No Alvo'}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAB: GASTOS & NOTAS --- */}
                <TabsContent value="gastos" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Receipt className="h-4 w-4" />
                                        Registro de Gastos & NFe
                                    </CardTitle>
                                    <CardDescription>Extração automática de custos fixos e variáveis</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="gap-2">
                                        <Upload className="h-4 w-4" />
                                        Importar NFe (XML)
                                    </Button>
                                    <Button size="sm" className="gap-2" onClick={() => setShowExpenseDialog(true)}>
                                        <Plus className="h-4 w-4" />
                                        Novo Lançamento
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {expenses.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                    Nenhum gasto registrado. Importe uma nota fiscal para começar.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            expenses.map(exp => (
                                                <TableRow key={exp.id}>
                                                    <TableCell>{exp.date}</TableCell>
                                                    <TableCell className="font-medium">{exp.description}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{exp.category === 'fixed' ? 'Fixo' : 'Variável'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">R$ {exp.amount.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={exp.status === 'paid' ? 'default' : 'secondary'} className={exp.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : ''}>
                                                            {exp.status === 'paid' ? 'Pago' : 'Pendente'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {exp.document_url && (
                                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => window.open(exp.document_url, '_blank')}>
                                                                <FileText className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium">Distribuição de Gastos</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                                            <YAxis hide />
                                            <RechartsTooltip formatter={(v) => `R$ ${v}`} />
                                            <Bar dataKey="valor" fill="#1b5e3f" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card className="bg-emerald-50 border-emerald-100">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-emerald-800 font-bold uppercase">Cashflow Total</p>
                                            <p className="text-xl font-black text-emerald-600">R$ {expenses.reduce((a, b) => a + b.amount, 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB: RH & FOLHA --- */}
                <TabsContent value="folha" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Folha de Pagamento & Freelancers
                                    </CardTitle>
                                    <CardDescription>Gestão de remuneração da equipe</CardDescription>
                                </div>
                                <Button size="sm" className="gap-2" onClick={() => setShowPayrollDialog(true)}>
                                    <Plus className="h-4 w-4" />
                                    Lançar Vencimento
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Colaborador</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Ação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {payroll.length === 0 ? (
                                            collaborators.map(c => (
                                                <TableRow key={c.id}>
                                                    <TableCell className="font-medium">{c.name}</TableCell>
                                                    <TableCell><Badge variant="outline">Salário</Badge></TableCell>
                                                    <TableCell className="text-muted-foreground">-</TableCell>
                                                    <TableCell className="text-right font-bold text-muted-foreground">R$ 0,00</TableCell>
                                                    <TableCell><Badge variant="outline" className="opacity-50">Não Lançado</Badge></TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            payroll.map(p => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-medium">{p.collaborator_name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{p.type === 'freelance' ? 'Freelancer' : 'Salário'}</Badge>
                                                    </TableCell>
                                                    <TableCell>{p.date}</TableCell>
                                                    <TableCell className="text-right font-bold text-emerald-600">R$ {p.amount.toFixed(2)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={p.status === 'paid' ? 'default' : 'secondary'}>
                                                            {p.status === 'paid' ? 'Pago' : 'Agendado'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button size="sm" variant="outline" className="h-8 gap-1 pr-2 pl-2" onClick={() => toast.info('Gerando PDF do holerite...')}>
                                                            <FileText className="h-3 w-3" />
                                                            PDF
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            <Card className="bg-primary border-primary">
                                <CardContent className="p-4 text-primary-foreground">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                            <Wallet className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] opacity-80 font-bold uppercase">Total Folha do Mês</p>
                                            <p className="text-2xl font-black">R$ {payroll.reduce((a, b) => a + b.amount, 0).toFixed(2) || '0,00'}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                                        Resumo por Categoria
                                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 p-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">Salários Fixos</span>
                                            <span className="font-bold">R$ {payroll.filter(p => p.type === 'salary').reduce((a, b) => a + b.amount, 0).toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                                            <div className="bg-primary h-full" style={{ width: '85%' }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground font-medium">Freelancers / Diárias</span>
                                            <span className="font-bold">R$ {payroll.filter(p => p.type === 'freelance').reduce((a, b) => a + b.amount, 0).toFixed(2)}</span>
                                        </div>
                                        <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                                            <div className="bg-orange-500 h-full" style={{ width: '15%' }} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Expense Dialog */}
            <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Lançamento de Gasto</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                                value={newExpense.description}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                placeholder="Ex: Aluguel, Conta de Luz, Fornecedor X"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <Input
                                    type="number"
                                    value={newExpense.amount}
                                    onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Data</Label>
                                <Input
                                    type="date"
                                    value={newExpense.date}
                                    onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Categoria</Label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newExpense.category}
                                    onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}
                                >
                                    <option value="fixed">Fixo</option>
                                    <option value="variable">Variável</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newExpense.status}
                                    onChange={e => setNewExpense({ ...newExpense, status: e.target.value as any })}
                                >
                                    <option value="pending">Pendente</option>
                                    <option value="paid">Pago</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nº do Documento (NF-e)</Label>
                                <Input
                                    value={newExpense.invoice_number}
                                    onChange={e => setNewExpense({ ...newExpense, invoice_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Link do Documento (Cloud)</Label>
                                <Input
                                    value={newExpense.document_url}
                                    onChange={e => setNewExpense({ ...newExpense, document_url: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowExpenseDialog(false)}>Cancelar</Button>
                        <Button onClick={handleAddExpense}>Salvar Gasto</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payroll Dialog */}
            <Dialog open={showPayrollDialog} onOpenChange={setShowPayrollDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Lançar Vencimento / Contracheque</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Colaborador</Label>
                            <select
                                className="w-full p-2 rounded-md border bg-background"
                                value={newPayroll.collaborator_id}
                                onChange={e => {
                                    const c = collaborators.find(col => col.id === e.target.value);
                                    setNewPayroll({ ...newPayroll, collaborator_id: e.target.value, collaborator_name: c?.name || '' });
                                }}
                            >
                                <option value="">Selecione...</option>
                                {collaborators.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-muted/30 p-4 rounded-xl space-y-3 border border-dashed">
                            <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Detalhes do Contracheque</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Salário Base</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={newPayroll.payslip_data?.base_salary}
                                        onChange={e => setNewPayroll({
                                            ...newPayroll,
                                            payslip_data: { ...newPayroll.payslip_data!, base_salary: Number(e.target.value) }
                                        })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Horas Extras</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={newPayroll.payslip_data?.overtime}
                                        onChange={e => setNewPayroll({
                                            ...newPayroll,
                                            payslip_data: { ...newPayroll.payslip_data!, overtime: Number(e.target.value) }
                                        })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Bônus/Prêmios</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={newPayroll.payslip_data?.bonuses}
                                        onChange={e => setNewPayroll({
                                            ...newPayroll,
                                            payslip_data: { ...newPayroll.payslip_data!, bonuses: Number(e.target.value) }
                                        })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px]">Descontos (INSS/Faltas)</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs"
                                        value={newPayroll.payslip_data?.deductions}
                                        onChange={e => setNewPayroll({
                                            ...newPayroll,
                                            payslip_data: { ...newPayroll.payslip_data!, deductions: Number(e.target.value) }
                                        })}
                                    />
                                </div>
                            </div>
                            <div className="pt-2 mt-2 border-t border-dashed flex justify-between items-center">
                                <span className="text-xs font-bold">Líquido Estimado:</span>
                                <span className="font-black text-emerald-600">
                                    R$ {((newPayroll.payslip_data?.base_salary || 0) + (newPayroll.payslip_data?.overtime || 0) + (newPayroll.payslip_data?.bonuses || 0) - (newPayroll.payslip_data?.deductions || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Data do Pagamento</Label>
                                <Input
                                    type="date"
                                    value={newPayroll.date}
                                    onChange={e => setNewPayroll({ ...newPayroll, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <select
                                    className="w-full p-2 rounded-md border bg-background"
                                    value={newPayroll.status}
                                    onChange={e => setNewPayroll({ ...newPayroll, status: e.target.value as any })}
                                >
                                    <option value="pending">Agendado</option>
                                    <option value="paid">Pago</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPayrollDialog(false)}>Cancelar</Button>
                        <Button onClick={handleAddPayroll}>Gerar Lançamento</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

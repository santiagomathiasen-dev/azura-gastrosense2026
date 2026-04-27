import { Bot, Sparkles, TrendingUp, AlertCircle, ChefHat, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePurchaseCalculationByPeriod } from '@/hooks/purchases/usePurchaseCalculationByPeriod';
import { useProductions } from '@/hooks/ops/useProductions';
import { useSaleProducts } from '@/hooks/financial/useSaleProducts';
import { useMemo } from 'react';
import { getTodayStr } from '@/lib/utils';

export function AIAssistant() {
    const { productions } = useProductions();
    const { purchaseNeeds, totalEstimatedCost, urgentCount } = usePurchaseCalculationByPeriod({ productions });
    const { saleProducts } = useSaleProducts();

    const insights = useMemo(() => {
        const list: { icon: any; text: string; type: 'info' | 'warning' | 'success' }[] = [];

        // 1. Sale Products Gap Insight
        const productsToPrepare = saleProducts.filter(p => (p.minimum_stock || 0) > (p.ready_quantity || 0));
        if (productsToPrepare.length > 0) {
            const topProduct = productsToPrepare[0];
            const gap = (topProduct.minimum_stock || 0) - (topProduct.ready_quantity || 0);
            list.push({
                icon: ChefHat,
                text: `Seu estoque de "${topProduct.name}" está baixo. Sugiro preparar pelo menos ${gap} unidades para garantir as vendas de hoje.`,
                type: 'warning'
            });
        }

        // 2. Urgent Purchases Insight
        if (urgentCount > 0) {
            list.push({
                icon: ShoppingCart,
                text: `Existem ${urgentCount} insumos em estado crítico. Garanta a compra deles o quanto antes para não parar sua produção.`,
                type: 'warning'
            });
        }

        // 3. Financial Insight
        if (totalEstimatedCost > 1000) {
            list.push({
                icon: TrendingUp,
                text: `O investimento estimado para as compras do período é de R$ ${totalEstimatedCost.toFixed(2)}. Fique atento ao fluxo de caixa.`,
                type: 'info'
            });
        }

        // 4. Productivity Insight
        const todayProductions = productions.filter(p => {
            const today = getTodayStr();
            return p.scheduled_date.startsWith(today) && p.status === 'planned';
        });

        if (todayProductions.length > 0) {
            list.push({
                icon: Sparkles,
                text: `Você tem ${todayProductions.length} produções planejadas para hoje. Organize sua equipe para iniciar pelas mais complexas!`,
                type: 'success'
            });
        }

        // Default if nothing else
        if (list.length === 0) {
            list.push({
                icon: Bot,
                text: "Tudo sob controle! Seu estoque e produções estão dentro dos parâmetros esperados no momento.",
                type: 'success'
            });
        }

        return list.slice(0, 3); // Show top 3 insights
    }, [productions, saleProducts, urgentCount, totalEstimatedCost]);

    return (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <Bot className="h-5 w-5" />
                        Assistente Inteligente
                    </CardTitle>
                    <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary/20">
                        Análise em tempo real
                    </Badge>
                </div>
                <CardDescription>
                    Minhas recomendações para a sua gestão hoje
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {insights.map((insight, index) => (
                    <div key={index} className="flex gap-3 items-start p-3 rounded-lg bg-background/50 border border-border/50 shadow-sm animate-in fade-in slide-in-from-left-2 transition-all hover:shadow-md">
                        <div className={`mt-0.5 p-1.5 rounded-full ${insight.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                            insight.type === 'success' ? 'bg-green-100 text-green-600' :
                                'bg-blue-100 text-blue-600'
                            }`}>
                            <insight.icon className="h-4 w-4" />
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {insight.text}
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

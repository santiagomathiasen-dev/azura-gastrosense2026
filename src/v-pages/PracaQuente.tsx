import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useSaleProducts } from '@/hooks/financial/useSaleProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Zap, ChefHat, AlertCircle, Plus, Minus } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PracaQuente() {
    const { saleProducts, isLoading, hotStationSale } = useSaleProducts();
    const [searchTerm, setSearchTerm] = useState('');

    // Local state for quantities
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const filteredProducts = saleProducts.filter(p =>
        p.is_active &&
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getQuantity = (id: string) => quantities[id] || 1;
    const setQuantity = (id: string, qty: number) => {
        setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }));
    };

    const handleSell = async (productId: string) => {
        const quantity = getQuantity(productId);
        await hotStationSale.mutateAsync({ sale_product_id: productId, quantity });
        // Reset quantity back to 1 after successful sale
        setQuantity(productId, 1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <PageHeader
                    title="Praça Quente (PDV)"
                    description="Produção sob demanda. Venda aqui para deduzir os ingredientes instantaneamente do estoque."
                />

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar produto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <Alert className="bg-orange-500/10 text-orange-600 border-orange-200">
                <Zap className="h-4 w-4" />
                <AlertTitle>Atenção - Produção Automática</AlertTitle>
                <AlertDescription>
                    Ao clicar em <strong>"Vender"</strong>, o sistema explodirá a ficha técnica do produto e consumirá os insumos brutos automaticamente.
                </AlertDescription>
            </Alert>

            {isLoading ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
            ) : filteredProducts.length === 0 ? (
                <EmptyState
                    icon={ChefHat}
                    title="Nenhum produto encontrado"
                    description="Nenhum produto disponível para venda neste momento."
                />
            ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map(product => {
                        const qty = getQuantity(product.id);
                        const isSelling = hotStationSale.isPending && hotStationSale.variables?.sale_product_id === product.id;

                        return (
                            <Card key={product.id} className="overflow-hidden border-border/50 hover:shadow-md transition-shadow">
                                {product.image_url ? (
                                    <div className="h-32 w-full bg-muted relative">
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-20 w-full bg-primary/5 flex items-center justify-center">
                                        <ChefHat className="h-8 w-8 text-primary/40" />
                                    </div>
                                )}

                                <CardContent className="p-4 space-y-4 text-center">
                                    <div>
                                        <h3 className="font-semibold text-lg line-clamp-1" title={product.name}>
                                            {product.name}
                                        </h3>
                                        <p className="text-xl font-bold text-primary mt-1">
                                            {product.sale_price ? `R$ ${product.sale_price.toFixed(2)}` : 'Preço não definido'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => setQuantity(product.id, qty - 1)}
                                                disabled={qty <= 1 || isSelling}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="font-medium text-lg w-8 text-center">{qty}</span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => setQuantity(product.id, qty + 1)}
                                                disabled={isSelling}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>

                                        <Button
                                            onClick={() => handleSell(product.id)}
                                            disabled={isSelling}
                                            className="w-full h-12 text-base gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                                        >
                                            <Zap className="h-4 w-4 shrink-0" />
                                            {isSelling ? 'Processando...' : `Vender ${qty > 1 ? `(${qty})` : ''}`}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

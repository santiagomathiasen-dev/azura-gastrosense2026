import { useState } from 'react';
import { toast } from 'sonner';
import {
    Plus,
    Search,
    Pencil,
    Trash2,
    Phone,
    Mail,
    MapPin,
    Star,
    Truck,
    MessageCircle,
    FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSuppliers, type Supplier } from '@/hooks/purchases/useSuppliers';
import { SupplierForm } from './SupplierForm';
import { formatBrazilianNumber } from '@/lib/utils'; // Assuming this exists or standard utils
import { WhatsAppDialog } from './WhatsAppDialog';
import { getNow } from '@/lib/utils';

export function SupplierManagement() {
    const { suppliers, isLoading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
    const [search, setSearch] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [whatsAppDialogOpen, setWhatsAppDialogOpen] = useState(false);
    const [selectedSupplierForWhatsApp, setSelectedSupplierForWhatsApp] = useState<Supplier | null>(null);

    const filteredSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(search.toLowerCase()) ||
        supplier.category?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormOpen(true);
    };

    const handleDeleteClick = (supplier: Supplier) => {
        setSupplierToDelete(supplier);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (supplierToDelete) {
            deleteSupplier.mutate(supplierToDelete.id);
            setDeleteDialogOpen(false);
            setSupplierToDelete(null);
        }
    };

    const handleFormSubmit = (data: Partial<Supplier>) => {
        if (editingSupplier) {
            updateSupplier.mutate(
                { ...data, id: editingSupplier.id, updated_at: getNow().toISOString() } as any,
                {
                    onSuccess: () => {
                        setFormOpen(false);
                        setEditingSupplier(null);
                    },
                    onError: (error: any) => {
                        toast.error(error?.message?.includes('42501') ? "Erro de permissão: Falha ao salvar (RLS)." : "Erro ao salvar. Tente novamente.");
                    }
                }
            );
        } else {
            createSupplier.mutate(
                data as any,
                {
                    onSuccess: () => {
                        setFormOpen(false);
                        setEditingSupplier(null);
                    },
                    onError: (error: any) => {
                        toast.error(error?.message?.includes('42501') ? "Erro de permissão: Falha ao salvar (RLS)." : "Erro ao salvar. Tente novamente.");
                    }
                }
            );
        }
    };

    const handleFormOpenChange = (open: boolean) => {
        setFormOpen(open);
        if (!open) setEditingSupplier(null);
    };

    const openWhatsApp = (supplier: Supplier) => {
        const number = supplier.whatsapp_number || supplier.whatsapp;
        if (!number) return;
        setSelectedSupplierForWhatsApp(supplier);
        setWhatsAppDialogOpen(true);
    };

    if (isLoading) {
        return <div className="p-8 text-center">Carregando fornecedores...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar fornecedores..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Fornecedor
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map((supplier) => (
                    <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg font-bold">{supplier.name}</CardTitle>
                                    <CardDescription className="flex items-center mt-1">
                                        <Badge variant="secondary" className="mr-2">
                                            {supplier.category || 'Sem categoria'}
                                        </Badge>
                                        {supplier.quality_rating && (
                                            <div className="flex items-center text-yellow-500">
                                                <Star className="h-3 w-3 fill-current" />
                                                <span className="text-xs ml-1 font-medium">{supplier.quality_rating}</span>
                                            </div>
                                        )}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(supplier)}>
                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(supplier)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {supplier.cnpj_cpf && (
                                <div className="flex items-center text-muted-foreground">
                                    <FileText className="h-4 w-4 mr-2" />
                                    <span className="truncate">{supplier.cnpj_cpf}</span>
                                </div>
                            )}

                            {(supplier.phone || supplier.whatsapp) && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center text-muted-foreground">
                                        <Phone className="h-4 w-4 mr-2" />
                                        <span>{supplier.phone || supplier.whatsapp}</span>
                                    </div>
                                    {supplier.whatsapp && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => openWhatsApp(supplier)}
                                        >
                                            <MessageCircle className="h-4 w-4 mr-1" />
                                            WhatsApp
                                        </Button>
                                    )}
                                </div>
                            )}

                            {supplier.email && (
                                <div className="flex items-center text-muted-foreground">
                                    <Mail className="h-4 w-4 mr-2" />
                                    <span className="truncate">{supplier.email}</span>
                                </div>
                            )}

                            {supplier.city && (
                                <div className="flex items-center text-muted-foreground">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    <span className="truncate">{supplier.city}/{supplier.state}</span>
                                </div>
                            )}

                            {supplier.delivery_time_days && (
                                <div className="flex items-center text-muted-foreground">
                                    <Truck className="h-4 w-4 mr-2" />
                                    <span>Entrega em média {supplier.delivery_time_days} {supplier.delivery_time_days === 1 ? 'dia' : 'dias'}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredSuppliers.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                    <p>Nenhum fornecedor encontrado.</p>
                </div>
            )}

            <SupplierForm
                open={formOpen}
                onOpenChange={handleFormOpenChange}
                onSubmit={handleFormSubmit}
                initialData={editingSupplier}
                isLoading={false} // You might want to pass actual loading state from mutations
            />

            {selectedSupplierForWhatsApp && (
                <WhatsAppDialog
                    open={whatsAppDialogOpen}
                    onOpenChange={(open) => {
                        setWhatsAppDialogOpen(open);
                        if (!open) setSelectedSupplierForWhatsApp(null);
                    }}
                    supplierName={selectedSupplierForWhatsApp.name}
                    phoneNumber={selectedSupplierForWhatsApp.whatsapp_number || selectedSupplierForWhatsApp.whatsapp || ''}
                    supplierId={selectedSupplierForWhatsApp.id}
                />
            )}

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir o fornecedor <strong>{supplierToDelete?.name}</strong>?
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-500 hover:bg-red-600">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

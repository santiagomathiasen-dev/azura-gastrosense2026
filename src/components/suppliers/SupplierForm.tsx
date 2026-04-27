import { useState } from 'react';
import { Plus, Phone, Mail, Star, Truck, MapPin, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBrazilianNumber } from '@/lib/utils';
import type { Supplier } from '@/hooks/purchases/useSuppliers';

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Supplier>) => void;
  initialData?: Supplier | null;
  isLoading?: boolean;
}



const PAYMENT_METHODS = [
  'Boleto',
  'Pix',
  'Cartão de Crédito',
  'Transferência',
  'Dinheiro',
];

export function SupplierForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading,
}: SupplierFormProps) {
  const [name, setName] = useState(initialData?.name || '');

  const [cnpjCpf, setCnpjCpf] = useState((initialData as any)?.cnpj_cpf || '');
  const [phone, setPhone] = useState((initialData as any)?.phone || '');
  const [whatsapp, setWhatsapp] = useState((initialData as any)?.whatsapp || '');
  const [email, setEmail] = useState((initialData as any)?.email || '');
  const [deliveryDays, setDeliveryDays] = useState(String((initialData as any)?.delivery_time_days || 3));
  const [rating, setRating] = useState(String((initialData as any)?.quality_rating || 3));
  const [paymentMethod, setPaymentMethod] = useState((initialData as any)?.payment_method || '');
  const [zipCode, setZipCode] = useState((initialData as any)?.zip_code || '');
  const [address, setAddress] = useState((initialData as any)?.address || '');
  const [city, setCity] = useState((initialData as any)?.city || '');
  const [state, setState] = useState((initialData as any)?.state || '');
  const [notes, setNotes] = useState((initialData as any)?.notes || '');

  const handleSubmit = () => {
    if (!name.trim()) return;

    // Clean WhatsApp number for database
    const whatsappNumber = whatsapp?.replace(/\D/g, '') || null;

    onSubmit({
      name: name.trim(),

      cnpj_cpf: cnpjCpf || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      whatsapp_number: whatsappNumber,
      email: email || null,
      delivery_time_days: parseInt(deliveryDays) || 3,
      quality_rating: parseInt(rating) || 3,
      payment_method: paymentMethod || null,
      zip_code: zipCode || null,
      address: address || null,
      city: city || null,
      state: state || null,
      notes: notes || null,
    } as any);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setName(initialData?.name || '');

      setCnpjCpf((initialData as any)?.cnpj_cpf || '');
      setPhone((initialData as any)?.phone || '');
      setWhatsapp((initialData as any)?.whatsapp || '');
      setEmail((initialData as any)?.email || '');
      setDeliveryDays(String((initialData as any)?.delivery_time_days || 3));
      setRating(String((initialData as any)?.quality_rating || 3));
      setPaymentMethod((initialData as any)?.payment_method || '');
      setZipCode((initialData as any)?.zip_code || '');
      setAddress((initialData as any)?.address || '');
      setCity((initialData as any)?.city || '');
      setState((initialData as any)?.state || '');
      setNotes((initialData as any)?.notes || '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </DialogTitle>
        <DialogDescription className="sr-only">Detalhes do diálogo</DialogDescription>
</DialogHeader>

        <div className="space-y-4 py-4">
          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpjCpf">CNPJ / CPF</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cnpjCpf"
                  value={cnpjCpf}
                  onChange={(e) => setCnpjCpf(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 0000-0000"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@fornecedor.com"
                className="pl-10"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-2">
            <Label>Endereço</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Input
                  placeholder="CEP"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  placeholder="Logradouro, Nº"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="col-span-2">
                <Input
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <Input
                  placeholder="UF"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Avaliação */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryDays">Prazo de Entrega (dias)</Label>
              <div className="relative">
                <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deliveryDays"
                  type="number"
                  min="1"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Qualidade (1-5)</Label>
              <div className="relative">
                <Star className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger className="pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <SelectItem key={r} value={String(r)}>
                        {'★'.repeat(r)}{'☆'.repeat(5 - r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {initialData ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

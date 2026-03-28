import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
import { CollaboratorProvider } from "@/contexts/CollaboratorProvider";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Loader2 } from "lucide-react";
import { NavigationProvider } from "@/contexts/NavigationProvider";

// Lazy loading components
const Auth = lazy(() => import("@/v-pages/Auth"));
const Dashboard = lazy(() => import("@/v-pages/Dashboard"));
const Estoque = lazy(() => import("@/v-pages/Estoque"));
const Fichas = lazy(() => import("@/v-pages/Fichas"));
const Producao = lazy(() => import("@/v-pages/Producao"));
const Compras = lazy(() => import("@/v-pages/Compras"));
const EstoqueProducao = lazy(() => import("@/v-pages/EstoqueProducao"));
const EstoqueFinalizados = lazy(() => import("@/v-pages/EstoqueFinalizados"));
const EstoqueInsumosProduzidos = lazy(() => import("@/v-pages/EstoqueInsumosProduzidos"));
const ProdutosVenda = lazy(() => import("@/v-pages/ProdutosVenda"));
const PracaQuente = lazy(() => import("@/v-pages/PracaQuente"));
const Cadastros = lazy(() => import("@/v-pages/Cadastros"));
const Relatorios = lazy(() => import("@/v-pages/Relatorios"));
const Financeiro = lazy(() => import("@/v-pages/Financeiro"));
const Perdas = lazy(() => import("@/v-pages/Perdas"));
const PrevisaoVendas = lazy(() => import("@/v-pages/PrevisaoVendas"));
const PaymentRequired = lazy(() => import("@/v-pages/PaymentRequired"));
const Colaboradores = lazy(() => import("@/v-pages/Colaboradores"));
const Gestores = lazy(() => import("@/v-pages/Gestores"));
const NotFound = lazy(() => import("@/v-pages/NotFound"));
const Landing = lazy(() => import("@/v-pages/Landing"));
const ConfiguracaoPDV = lazy(() => import("@/v-pages/ConfiguracaoPDV"));

const LoadingFallback = () => (
  <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-muted-foreground animate-pulse">Carregando módulo...</p>
  </div>
);

const queryClient = new QueryClient();

const AppContent = () => {
  const navigate = useNavigate();
  return (
    <NavigationProvider navigate={navigate}>
      <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cadastros" element={<Cadastros />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/estoque-producao" element={<EstoqueProducao />} />
            <Route path="/fichas" element={<Fichas />} />
            <Route path="/producao" element={<Producao />} />
            <Route path="/compras" element={<Compras />} />
            <Route path="/estoque-finalizados" element={<EstoqueFinalizados />} />
            <Route path="/estoque-insumos-produzidos" element={<EstoqueInsumosProduzidos />} />
            <Route path="/produtos-venda" element={<ProdutosVenda />} />
            <Route path="/praca-quente" element={<PracaQuente />} />
            <Route path="/perdas" element={<Perdas />} />
            <Route path="/previsao-vendas" element={<PrevisaoVendas />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/financeiro" element={<Financeiro />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/gestores" element={<Gestores />} />
            <Route path="/config-pdv" element={<ConfiguracaoPDV />} />
            <Route path="/payment-required" element={<PaymentRequired />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </NavigationProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <CollaboratorProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </TooltipProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

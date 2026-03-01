import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CollaboratorProvider } from "@/contexts/CollaboratorContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/layouts/MainLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Loader2 } from "lucide-react";

// Lazy loading components for better performance
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Estoque = lazy(() => import("@/pages/Estoque"));
const Fichas = lazy(() => import("@/pages/Fichas"));
const Producao = lazy(() => import("@/pages/Producao"));
const Compras = lazy(() => import("@/pages/Compras"));
const EstoqueProducao = lazy(() => import("@/pages/EstoqueProducao"));
const EstoqueFinalizados = lazy(() => import("@/pages/EstoqueFinalizados"));
const EstoqueInsumosProduzidos = lazy(() => import("@/pages/EstoqueInsumosProduzidos"));
const ProdutosVenda = lazy(() => import("@/pages/ProdutosVenda"));
const PracaQuente = lazy(() => import("@/pages/PracaQuente"));
const Cadastros = lazy(() => import("@/pages/Cadastros"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));
const Perdas = lazy(() => import("@/pages/Perdas"));
const PrevisaoVendas = lazy(() => import("@/pages/PrevisaoVendas"));
const PaymentRequired = lazy(() => import("@/pages/PaymentRequired"));
const Colaboradores = lazy(() => import("@/pages/Colaboradores"));
const Gestores = lazy(() => import("@/pages/Gestores"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Landing = lazy(() => import("@/pages/Landing"));
const ConfiguracaoPDV = lazy(() => import("@/pages/ConfiguracaoPDV"));

const LoadingFallback = () => (
  <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <p className="text-muted-foreground animate-pulse">Carregando módulo...</p>
  </div>
);


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CollaboratorProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt />
            <BrowserRouter>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Landing />} />

                  {/* Protected Routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  >
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

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </CollaboratorProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>

);

export default App;

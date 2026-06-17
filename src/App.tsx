import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/app/Dashboard";
import ComingSoon from "./pages/app/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<ComingSoon title="Pedidos" desc="Gestión de pedidos en tiempo real." />} />
              <Route path="kitchen" element={<ComingSoon title="Cocina (KDS)" desc="Pantalla de comandas para cocina." />} />
              <Route path="tables" element={<ComingSoon title="Mesas" desc="Mesas, QR y disponibilidad." />} />
              <Route path="menu" element={<ComingSoon title="Menú" desc="Productos de tu carta." />} />
              <Route path="categories" element={<ComingSoon title="Categorías" desc="Organizá tu menú." />} />
              <Route path="branches" element={<ComingSoon title="Sucursales" desc="Tus locales y direcciones." />} />
              <Route path="team" element={<ComingSoon title="Equipo" desc="Usuarios y roles." />} />
              <Route path="settings" element={<ComingSoon title="Configuración" desc="Datos del restaurante, facturación y conexiones." />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

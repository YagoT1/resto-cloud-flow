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
import Categories from "./pages/app/Categories";
import Menu from "./pages/app/Menu";
import Tables from "./pages/app/Tables";
import Kitchen from "./pages/app/Kitchen";
import Orders from "./pages/app/Orders";
import PublicMenu from "./pages/PublicMenu";
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
            <Route path="/m/:slug" element={<PublicMenu />} />
            <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="kitchen" element={<Kitchen />} />
              <Route path="tables" element={<Tables />} />
              <Route path="menu" element={<Menu />} />
              <Route path="categories" element={<Categories />} />
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

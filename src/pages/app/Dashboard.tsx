import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, ClipboardList, Users, TrendingUp, ArrowRight, UtensilsCrossed, Table2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ products: 0, tables: 0, orders: 0, branches: 0 });

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const load = async () => {
      const rid = profile.restaurant_id;
      const [p, t, o, b] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
        supabase.from("restaurant_tables").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
        supabase.from("branches").select("id", { count: "exact", head: true }).eq("restaurant_id", rid),
      ]);
      setStats({ products: p.count ?? 0, tables: t.count ?? 0, orders: o.count ?? 0, branches: b.count ?? 0 });
    };
    load();
  }, [profile?.restaurant_id]);

  const kpis = [
    { label: "Ventas hoy", value: "$0", icon: DollarSign, hint: "Sin pedidos aún" },
    { label: "Pedidos", value: stats.orders, icon: ClipboardList, hint: "Total histórico" },
    { label: "Productos", value: stats.products, icon: UtensilsCrossed, hint: "En el menú" },
    { label: "Mesas", value: stats.tables, icon: Table2, hint: `${stats.branches} sucursal(es)` },
  ];

  return (
    <div className="container py-8">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">¡Hola, {profile?.full_name?.split(" ")[0] ?? "chef"}! 👋</h1>
          <p className="text-muted-foreground">Este es el resumen de tu restaurante hoy.</p>
        </div>
        <Button asChild className="bg-gradient-brand shadow-md hover:opacity-95">
          <Link to="/app/menu">Agregar producto <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold">{k.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.hint}</div>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Pedidos recientes</h3>
            <Button asChild variant="ghost" size="sm"><Link to="/app/orders">Ver todos</Link></Button>
          </div>
          <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <TrendingUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cuando tengas pedidos, los verás acá en tiempo real.</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold">Primeros pasos</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li><Link to="/app/categories" className="flex items-center justify-between rounded-lg p-2 hover:bg-muted">Crear categorías <ArrowRight className="h-4 w-4" /></Link></li>
            <li><Link to="/app/menu" className="flex items-center justify-between rounded-lg p-2 hover:bg-muted">Agregar productos <ArrowRight className="h-4 w-4" /></Link></li>
            <li><Link to="/app/tables" className="flex items-center justify-between rounded-lg p-2 hover:bg-muted">Configurar mesas y QR <ArrowRight className="h-4 w-4" /></Link></li>
            <li><Link to="/app/team" className="flex items-center justify-between rounded-lg p-2 hover:bg-muted">Invitar a tu equipo <ArrowRight className="h-4 w-4" /></Link></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

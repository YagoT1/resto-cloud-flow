import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, Download } from "lucide-react";

interface Order {
  id: string;
  total: number;
  status: string;
  created_at: string;
}
interface Item {
  product_name: string;
  quantity: number;
  unit_price: number;
  order_id: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function Reports() {
  const { profile } = useAuth();
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(today());
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const start = new Date(from + "T00:00:00").toISOString();
    const end = new Date(to + "T23:59:59").toISOString();
    const { data: o } = await supabase
      .from("orders")
      .select("id, total, status, created_at")
      .eq("restaurant_id", profile.restaurant_id)
      .gte("created_at", start)
      .lte("created_at", end);
    const list = (o ?? []) as Order[];
    setOrders(list);
    const ids = list.map((x) => x.id);
    if (ids.length) {
      const { data: it } = await supabase
        .from("order_items")
        .select("product_name, quantity, unit_price, order_id")
        .in("order_id", ids);
      setItems((it ?? []) as Item[]);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id, from, to]);

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + Number(o.total), 0);
    const count = valid.length;
    const avg = count ? revenue / count : 0;
    const cancelled = orders.length - count;
    return { revenue, count, avg, cancelled };
  }, [orders]);

  const byDay = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const d = o.created_at.slice(0, 10);
      const cur = map.get(d) ?? { revenue: 0, count: 0 };
      cur.revenue += Number(o.total);
      cur.count += 1;
      map.set(d, cur);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  const topProducts = useMemo(() => {
    const validIds = new Set(orders.filter((o) => o.status !== "cancelled").map((o) => o.id));
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const it of items) {
      if (!validIds.has(it.order_id)) continue;
      const cur = map.get(it.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.quantity * Number(it.unit_price);
      map.set(it.product_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [items, orders]);

  const maxDay = Math.max(1, ...byDay.map(([, v]) => v.revenue));

  const exportCsv = () => {
    const rows = [
      ["fecha", "pedidos", "ingresos"],
      ...byDay.map(([d, v]) => [d, String(v.count), v.revenue.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${from}-${to}.csv`;
    a.click();
  };

  const fmt = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="mt-1 text-muted-foreground">Ventas, productos más vendidos y cierre de caja.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ingresos" value={fmt(stats.revenue)} icon={DollarSign} />
        <StatCard label="Pedidos" value={String(stats.count)} icon={ShoppingBag} />
        <StatCard label="Ticket promedio" value={fmt(stats.avg)} icon={TrendingUp} />
        <StatCard label="Cancelados" value={String(stats.cancelled)} icon={BarChart3} />
      </div>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">Ventas por día</h2>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Cargando...</div>
        ) : byDay.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Sin datos en el período seleccionado.</div>
        ) : (
          <div className="space-y-2">
            {byDay.map(([d, v]) => (
              <div key={d} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                <div className="text-sm text-muted-foreground">{d}</div>
                <div className="h-7 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full bg-gradient-brand"
                    style={{ width: `${(v.revenue / maxDay) * 100}%` }}
                  />
                </div>
                <div className="w-28 text-right text-sm font-medium">{fmt(v.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-semibold">Top productos</h2>
        {topProducts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Sin productos vendidos.</div>
        ) : (
          <div className="divide-y">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">{i + 1}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{p.qty} ud.</div>
                  <div className="text-xs text-muted-foreground">{fmt(p.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </Card>
  );
}

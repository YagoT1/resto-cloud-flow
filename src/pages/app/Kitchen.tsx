import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, Clock, CheckCircle2, Utensils } from "lucide-react";
import { toast } from "sonner";

type Status = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled" | "paid";

interface Order {
  id: string;
  order_number: number;
  status: Status;
  type: string;
  table_id: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
  total: number;
}
interface Item {
  id: string; order_id: string; product_name: string; quantity: number; notes: string | null;
}
interface TableMap { [id: string]: string }

const COLUMNS: { key: Status; title: string; next: Status | null; nextLabel: string; tone: string }[] = [
  { key: "pending",   title: "Nuevos",       next: "preparing", nextLabel: "Empezar",      tone: "border-amber-500/50" },
  { key: "preparing", title: "En cocina",    next: "ready",     nextLabel: "Marcar listo", tone: "border-blue-500/50" },
  { key: "ready",     title: "Listos",       next: "delivered", nextLabel: "Entregado",    tone: "border-emerald-500/50" },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Kitchen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, Item[]>>({});
  const [tables, setTables] = useState<TableMap>({});
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    const { data: os } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", profile.restaurant_id)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });
    const list = (os ?? []) as Order[];
    setOrders(list);
    if (list.length > 0) {
      const { data: its } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", list.map((o) => o.id));
      const map: Record<string, Item[]> = {};
      (its ?? []).forEach((i) => {
        (map[(i as Item).order_id] ||= []).push(i as Item);
      });
      setItemsByOrder(map);
    } else {
      setItemsByOrder({});
    }
    const { data: ts } = await supabase.from("restaurant_tables")
      .select("id, number").eq("restaurant_id", profile.restaurant_id);
    const tm: TableMap = {};
    (ts ?? []).forEach((t) => { tm[(t as { id: string; number: string }).id] = (t as { id: string; number: string }).number });
    setTables(tm);
  }, [profile?.restaurant_id]);

  useEffect(() => { load(); }, [load]);

  // tick every 15s to refresh the time-ago labels
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(i);
  }, []);

  // realtime subscriptions
  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const ch = supabase
      .channel(`kds-${profile.restaurant_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${profile.restaurant_id}` },
        (payload) => {
          if (payload.eventType === "INSERT") toast.success(`Nuevo pedido #${(payload.new as Order).order_number}`);
          load();
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.restaurant_id, load]);

  const advance = async (o: Order, next: Status) => {
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cocina (KDS)</h1>
          <p className="mt-1 text-muted-foreground">Comandas en tiempo real.</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> En vivo
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => o.status === col.key);
          return (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{col.title}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{list.length}</span>
              </div>
              {list.length === 0 ? (
                <Card className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                  <ChefHat className="h-6 w-6 opacity-50" />
                  <span className="text-sm">Sin pedidos</span>
                </Card>
              ) : list.map((o) => (
                <Card key={o.id} className={`border-l-4 p-4 ${col.tone}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">#{o.order_number}</span>
                        {o.table_id && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            Mesa {tables[o.table_id] ?? "?"}
                          </span>
                        )}
                        {!o.table_id && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {o.type === "takeaway" ? "Retira" : o.type === "delivery" ? "Delivery" : "Salón"}
                          </span>
                        )}
                      </div>
                      {o.customer_name && (
                        <div className="mt-0.5 text-sm text-muted-foreground">{o.customer_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {timeAgo(o.created_at)}
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm">
                    {(itemsByOrder[o.id] ?? []).map((i) => (
                      <li key={i.id} className="flex gap-2">
                        <span className="font-bold text-primary">{i.quantity}×</span>
                        <span>{i.product_name}</span>
                      </li>
                    ))}
                  </ul>

                  {o.notes && (
                    <div className="mt-3 rounded-md bg-muted/60 p-2 text-xs italic text-muted-foreground">
                      “{o.notes}”
                    </div>
                  )}

                  {col.next && (
                    <Button className="mt-3 w-full" size="sm" onClick={() => advance(o, col.next!)}>
                      {col.key === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
                      {col.nextLabel}
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

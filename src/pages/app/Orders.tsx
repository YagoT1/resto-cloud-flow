import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ClipboardList, Clock, Printer, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { downloadTicketPdf } from "@/lib/printTicket";

type Status = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled" | "paid";

interface Order {
  id: string; order_number: number; status: Status; type: string;
  table_id: string | null; customer_name: string | null; notes: string | null;
  created_at: string; total: number;
}
interface Item { id: string; order_id: string; product_name: string; quantity: number; unit_price: number }

const statusOptions: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "preparing", label: "En cocina" },
  { value: "ready", label: "Listos" },
  { value: "delivered", label: "Entregados" },
  { value: "paid", label: "Pagados" },
  { value: "cancelled", label: "Cancelados" },
];

const statusColor: Record<Status, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  confirmed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  preparing: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  ready: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  delivered: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  paid: "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  cancelled: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
const statusLabel: Record<Status, string> = {
  pending: "Pendiente", confirmed: "Confirmado", preparing: "En cocina",
  ready: "Listo", delivered: "Entregado", paid: "Pagado", cancelled: "Cancelado",
};

export default function Orders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [tables, setTables] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Status | "all">("all");

  const load = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    let q = supabase.from("orders").select("*")
      .eq("restaurant_id", profile.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    const list = (data ?? []) as Order[];
    setOrders(list);

    if (list.length > 0) {
      const { data: its } = await supabase.from("order_items").select("*")
        .in("order_id", list.map((o) => o.id));
      const m: Record<string, Item[]> = {};
      (its ?? []).forEach((i) => { (m[(i as Item).order_id] ||= []).push(i as Item) });
      setItems(m);
    }
    const { data: ts } = await supabase.from("restaurant_tables")
      .select("id, number").eq("restaurant_id", profile.restaurant_id);
    const tm: Record<string, string> = {};
    (ts ?? []).forEach((t) => { tm[(t as { id: string; number: string }).id] = (t as { id: string; number: string }).number });
    setTables(tm);
  }, [profile?.restaurant_id, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    const ch = supabase
      .channel(`orders-${profile.restaurant_id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${profile.restaurant_id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.restaurant_id, load]);

  const setStatus = async (id: string, s: Status) => {
    const { error } = await supabase.from("orders").update({ status: s }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="mt-1 text-muted-foreground">Todos los pedidos del restaurante.</p>
        </div>
        <Select value={filter} onValueChange={(v: Status | "all") => setFilter(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-3">
        {orders.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-16 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Sin pedidos para mostrar.</p>
          </Card>
        ) : orders.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">#{o.order_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[o.status]}`}>
                    {statusLabel[o.status]}
                  </span>
                  {o.table_id ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Mesa {tables[o.table_id] ?? "?"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                      {o.type === "takeaway" ? "Retira" : o.type === "delivery" ? "Delivery" : "Salón"}
                    </span>
                  )}
                </div>
                {o.customer_name && <div className="mt-1 text-sm text-muted-foreground">{o.customer_name}</div>}
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${Number(o.total).toFixed(2)}</div>
                <Select value={o.status} onValueChange={(v: Status) => setStatus(o.id, v)}>
                  <SelectTrigger className="mt-2 w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabel) as Status[]).map((s) =>
                      <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ul className="mt-3 space-y-0.5 border-t pt-3 text-sm">
              {(items[o.id] ?? []).map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span><span className="font-semibold">{i.quantity}×</span> {i.product_name}</span>
                  <span className="text-muted-foreground">${(Number(i.unit_price) * i.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {o.notes && <div className="mt-2 rounded-md bg-muted/60 p-2 text-xs italic text-muted-foreground">“{o.notes}”</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Utensils, UtensilsCrossed, Plus, Minus, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Restaurant { id: string; name: string; logo_url: string | null }
interface Category { id: string; name: string; sort_order: number }
interface Product {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; category_id: string | null; sort_order: number;
}
interface CartItem { product: Product; qty: number }

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const mesa = params.get("mesa");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [placing, setPlacing] = useState(false);
  const [placedNumber, setPlacedNumber] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: r } = await supabase.from("restaurants")
        .select("id, name, logo_url").eq("slug", slug).maybeSingle();
      if (!r) { setNotFound(true); setLoading(false); return; }
      setRestaurant(r as Restaurant);

      const [{ data: c }, { data: p }, { data: b }, { data: t }] = await Promise.all([
        supabase.from("categories").select("id, name, sort_order")
          .eq("restaurant_id", r.id).eq("active", true).order("sort_order"),
        supabase.from("products").select("id, name, description, price, image_url, category_id, sort_order")
          .eq("restaurant_id", r.id).eq("available", true).order("sort_order"),
        supabase.from("branches").select("id").eq("restaurant_id", r.id).eq("active", true)
          .order("is_main", { ascending: false }).limit(1).maybeSingle(),
        mesa
          ? supabase.from("restaurant_tables").select("id").eq("restaurant_id", r.id).eq("number", mesa).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setCats((c ?? []) as Category[]);
      setProducts((p ?? []) as Product[]);
      setBranchId(b?.id ?? null);
      setTableId((t as { id: string } | null)?.id ?? null);
      setLoading(false);
    })();
  }, [slug, mesa]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    cats.forEach((c) => map.set(c.id, []));
    products.forEach((p) => {
      const key = p.category_id ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [cats, products]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.product.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { product: p, qty: 1 }];
    });
    toast.success(`${p.name} agregado`);
  };
  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((x) => (x.product.id === id ? { ...x, qty: x.qty + delta } : x))
        .filter((x) => x.qty > 0),
    );
  };

  const totalQty = cart.reduce((s, x) => s + x.qty, 0);
  const total = cart.reduce((s, x) => s + x.qty * Number(x.product.price), 0);

  const placeOrder = async () => {
    if (!restaurant || cart.length === 0 || !slug) return;
    setPlacing(true);
    const { data, error } = await supabase.rpc("create_public_order", {
      p_slug: slug,
      p_table_number: mesa ?? null,
      p_customer_name: customer.name || null,
      p_customer_phone: customer.phone || null,
      p_notes: customer.notes || null,
      p_items: cart.map((x) => ({
        product_id: x.product.id,
        quantity: x.qty,
      })),
    });
    setPlacing(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    setPlacedNumber(row?.order_number ?? null);
    setCart([]);
    setCustomer({ name: "", phone: "", notes: "" });
    setCartOpen(false);
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando menú...</div>;
  }
  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-2xl font-bold">Restaurante no encontrado</h1>
        <p className="text-muted-foreground">Revisá el enlace o el código QR.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            {restaurant?.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
                <Utensils className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{restaurant?.name}</h1>
              <p className="text-xs text-muted-foreground">Menú digital</p>
            </div>
          </div>
          {mesa && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Mesa {mesa}
            </span>
          )}
        </div>
      </header>

      {placedNumber !== null && (
        <div className="container mt-4">
          <Card className="flex items-center gap-3 border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <div className="font-semibold">¡Pedido #{placedNumber} enviado!</div>
              <div className="text-sm text-muted-foreground">La cocina ya lo recibió.</div>
            </div>
          </Card>
        </div>
      )}

      <main className="container mt-6 space-y-8">
        {cats.length === 0 && products.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-16 text-center">
            <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Este restaurante aún no publicó su menú.</p>
          </Card>
        ) : (
          cats.map((c) => {
            const list = grouped.get(c.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={c.id}>
                <h2 className="mb-3 text-xl font-bold">{c.name}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((p) => (
                    <Card key={p.id} className="flex gap-3 overflow-hidden p-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{p.name}</h3>
                          <span className="shrink-0 font-bold">${Number(p.price).toFixed(2)}</span>
                        </div>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                        )}
                        <div className="mt-auto flex justify-end pt-2">
                          <Button size="sm" onClick={() => addToCart(p)}>
                            <Plus className="h-4 w-4" /> Agregar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>

      {totalQty > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card p-3 shadow-lg">
          <div className="container">
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button className="w-full" size="lg">
                  <ShoppingCart className="h-5 w-5" />
                  Ver pedido · {totalQty} {totalQty === 1 ? "ítem" : "ítems"} · ${total.toFixed(2)}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
                <SheetHeader><SheetTitle>Tu pedido</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3">
                  {cart.map((x) => (
                    <div key={x.product.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{x.product.name}</div>
                        <div className="text-sm text-muted-foreground">${Number(x.product.price).toFixed(2)} c/u</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" onClick={() => updateQty(x.product.id, -1)}>
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center font-semibold">{x.qty}</span>
                        <Button size="icon" variant="outline" onClick={() => updateQty(x.product.id, 1)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="w-20 text-right font-semibold">
                        ${(x.qty * Number(x.product.price)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-3">
                  {!tableId && (
                    <>
                      <div className="space-y-1">
                        <Label>Nombre</Label>
                        <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Teléfono</Label>
                        <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <Label>Notas para la cocina</Label>
                    <Textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                      placeholder="Sin sal, aparte, etc." />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                <SheetFooter className="mt-4">
                  <Button className="w-full" size="lg" disabled={placing || !branchId} onClick={placeOrder}>
                    {placing ? "Enviando..." : "Enviar pedido"}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
    </div>
  );
}

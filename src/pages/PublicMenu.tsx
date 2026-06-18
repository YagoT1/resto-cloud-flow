import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Utensils, UtensilsCrossed } from "lucide-react";

interface Restaurant { id: string; name: string; logo_url: string | null }
interface Category { id: string; name: string; sort_order: number }
interface Product {
  id: string; name: string; description: string | null; price: number;
  image_url: string | null; category_id: string | null; sort_order: number;
}

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const mesa = params.get("mesa");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      const { data: r } = await supabase.from("restaurants")
        .select("id, name, logo_url").eq("slug", slug).maybeSingle();
      if (!r) { setNotFound(true); setLoading(false); return; }
      setRestaurant(r as Restaurant);
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("categories").select("id, name, sort_order")
          .eq("restaurant_id", r.id).eq("active", true).order("sort_order"),
        supabase.from("products").select("id, name, description, price, image_url, category_id, sort_order")
          .eq("restaurant_id", r.id).eq("available", true).order("sort_order"),
      ]);
      setCats((c ?? []) as Category[]);
      setProducts((p ?? []) as Product[]);
      setLoading(false);
    })();
  }, [slug]);

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
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card">
        <div className="container flex items-center justify-between py-5">
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{p.name}</h3>
                          <span className="shrink-0 font-bold">${Number(p.price).toFixed(2)}</span>
                        </div>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  category_id: string | null;
  image_url: string | null;
  sort_order: number;
}
interface Cat { id: string; name: string }

export default function Menu() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: 0, available: true, category_id: "", image_url: "", sort_order: 0,
  });

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const [{ data: ps }, { data: cs }] = await Promise.all([
      supabase.from("products").select("*").eq("restaurant_id", profile.restaurant_id).order("sort_order").order("name"),
      supabase.from("categories").select("id, name").eq("restaurant_id", profile.restaurant_id).order("sort_order").order("name"),
    ]);
    setItems((ps ?? []) as Product[]);
    setCats((cs ?? []) as Cat[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: 0, available: true, category_id: cats[0]?.id ?? "", image_url: "", sort_order: items.length });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", price: Number(p.price), available: p.available,
      category_id: p.category_id ?? "", image_url: p.image_url ?? "", sort_order: p.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!profile?.restaurant_id || !form.name.trim()) return;
    const payload = {
      restaurant_id: profile.restaurant_id,
      name: form.name,
      description: form.description || null,
      price: form.price,
      available: form.available,
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      sort_order: form.sort_order,
    };
    const res = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Producto actualizado" : "Producto creado");
    setOpen(false);
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Producto eliminado");
    load();
  };

  const filtered = filter === "all" ? items : items.filter((p) => p.category_id === filter);
  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Sin categoría";

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Menú</h1>
          <p className="mt-1 text-muted-foreground">Cargá los productos de tu carta.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> Nuevo producto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Milanesa napolitana" />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Precio</Label>
                    <Input type="number" step="0.01" value={form.price}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                      <SelectContent>
                        {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>URL de imagen (opcional)</Label>
                  <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
                  <Label>Disponible</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="col-span-full p-10 text-center text-muted-foreground">Cargando...</Card>
        ) : filtered.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Sin productos</h3>
            <p className="text-sm text-muted-foreground">
              {cats.length === 0
                ? "Creá primero una categoría desde el menú lateral."
                : "Agregá tu primer producto a la carta."}
            </p>
            {cats.length > 0 && <Button onClick={openNew}><Plus className="h-4 w-4" /> Nuevo producto</Button>}
          </Card>
        ) : (
          filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-36 w-full object-cover" />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-muted">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{catName(p.category_id)}</div>
                    <h3 className="truncate font-semibold">{p.name}</h3>
                  </div>
                  <span className="shrink-0 font-bold">${Number(p.price).toFixed(2)}</span>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-xs ${p.available ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {p.available ? "Disponible" : "No disponible"}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

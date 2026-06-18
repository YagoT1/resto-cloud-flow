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
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
}

export default function Categories() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", description: "", active: true, sort_order: 0 });

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", profile.restaurant_id)
      .order("sort_order")
      .order("name");
    setItems((data ?? []) as Category[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", active: true, sort_order: items.length });
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? "", active: c.active, sort_order: c.sort_order });
    setOpen(true);
  };

  const save = async () => {
    if (!profile?.restaurant_id || !form.name.trim()) return;
    const payload = { ...form, restaurant_id: profile.restaurant_id };
    const res = editing
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Categoría actualizada" : "Categoría creada");
    setOpen(false);
    load();
  };

  const remove = async (c: Category) => {
    if (!confirm(`¿Eliminar la categoría "${c.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Categoría eliminada");
    load();
  };

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Categorías</h1>
          <p className="mt-1 text-muted-foreground">Organizá los productos de tu carta.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva categoría</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Entradas, Bebidas..." />
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orden</Label>
                  <Input type="number" value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                  <Label>Activa</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8 grid gap-3">
        {loading ? (
          <Card className="p-10 text-center text-muted-foreground">Cargando...</Card>
        ) : items.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Tags className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Aún no hay categorías</h3>
            <p className="text-sm text-muted-foreground">Creá tu primera categoría para empezar a cargar productos.</p>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva categoría</Button>
          </Card>
        ) : (
          items.map((c) => (
            <Card key={c.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name}</span>
                  {!c.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Inactiva</span>}
                </div>
                {c.description && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{c.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

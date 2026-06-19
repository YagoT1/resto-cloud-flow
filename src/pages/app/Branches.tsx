import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Store, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_main: boolean;
  active: boolean;
}

export default function Branches() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", is_main: false, active: true });

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("restaurant_id", profile.restaurant_id)
      .order("is_main", { ascending: false })
      .order("name");
    setItems((data ?? []) as Branch[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", address: "", phone: "", is_main: false, active: true });
    setOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name, address: b.address ?? "", phone: b.phone ?? "",
      is_main: b.is_main, active: b.active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!profile?.restaurant_id || !form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      is_main: form.is_main,
      active: form.active,
      restaurant_id: profile.restaurant_id,
    };
    if (form.is_main) {
      await supabase.from("branches").update({ is_main: false })
        .eq("restaurant_id", profile.restaurant_id);
    }
    const res = editing
      ? await supabase.from("branches").update(payload).eq("id", editing.id)
      : await supabase.from("branches").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Sucursal actualizada" : "Sucursal creada");
    setOpen(false);
    load();
  };

  const remove = async (b: Branch) => {
    if (b.is_main) return toast.error("No podés eliminar la sucursal principal");
    if (!confirm(`¿Eliminar la sucursal "${b.name}"?`)) return;
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Sucursal eliminada");
    load();
  };

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sucursales</h1>
          <p className="mt-1 text-muted-foreground">Administrá tus locales y direcciones.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva sucursal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Principal</Label>
                  <p className="text-xs text-muted-foreground">Marca esta sucursal como la principal del restaurante.</p>
                </div>
                <Switch checked={form.is_main} onCheckedChange={(v) => setForm({ ...form, is_main: v })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Activa</Label>
                  <p className="text-xs text-muted-foreground">Si está inactiva no aparece en el menú público.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card className="col-span-full p-10 text-center text-muted-foreground">Cargando...</Card>
        ) : items.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Store className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Sin sucursales</h3>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva sucursal</Button>
          </Card>
        ) : (
          items.map((b) => (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{b.name}</h3>
                    {b.is_main && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                        <Star className="h-3 w-3" /> Principal
                      </span>
                    )}
                    {!b.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Inactiva</span>
                    )}
                  </div>
                  {b.address && (
                    <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {b.address}
                    </p>
                  )}
                  {b.phone && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {b.phone}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b)} disabled={b.is_main}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

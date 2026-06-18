import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, QrCode, Table2, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";
interface RTable {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  branch_id: string;
}
interface Branch { id: string; name: string }

const statusLabel: Record<TableStatus, string> = {
  available: "Disponible", occupied: "Ocupada", reserved: "Reservada", cleaning: "Limpieza",
};
const statusClasses: Record<TableStatus, string> = {
  available: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  occupied: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  reserved: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cleaning: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

export default function Tables() {
  const { profile } = useAuth();
  const [items, setItems] = useState<RTable[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [slug, setSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RTable | null>(null);
  const [form, setForm] = useState({ number: "", capacity: 2, status: "available" as TableStatus, branch_id: "" });
  const [qrTable, setQrTable] = useState<RTable | null>(null);

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const [{ data: t }, { data: b }, { data: r }] = await Promise.all([
      supabase.from("restaurant_tables").select("*").eq("restaurant_id", profile.restaurant_id).order("number"),
      supabase.from("branches").select("id, name").eq("restaurant_id", profile.restaurant_id).order("name"),
      supabase.from("restaurants").select("slug").eq("id", profile.restaurant_id).maybeSingle(),
    ]);
    setItems((t ?? []) as RTable[]);
    setBranches((b ?? []) as Branch[]);
    setSlug(r?.slug ?? "");
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id]);

  const openNew = () => {
    setEditing(null);
    setForm({ number: String(items.length + 1), capacity: 2, status: "available", branch_id: branches[0]?.id ?? "" });
    setOpen(true);
  };
  const openEdit = (t: RTable) => {
    setEditing(t);
    setForm({ number: t.number, capacity: t.capacity, status: t.status, branch_id: t.branch_id });
    setOpen(true);
  };

  const save = async () => {
    if (!profile?.restaurant_id || !form.number.trim() || !form.branch_id) return;
    const payload = { ...form, restaurant_id: profile.restaurant_id };
    const res = editing
      ? await supabase.from("restaurant_tables").update(payload).eq("id", editing.id)
      : await supabase.from("restaurant_tables").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Mesa actualizada" : "Mesa creada");
    setOpen(false);
    load();
  };

  const remove = async (t: RTable) => {
    if (!confirm(`¿Eliminar la mesa ${t.number}?`)) return;
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Mesa eliminada");
    load();
  };

  const qrUrl = useMemo(() => {
    if (!qrTable || !slug) return "";
    return `${window.location.origin}/m/${slug}?mesa=${encodeURIComponent(qrTable.number)}`;
  }, [qrTable, slug]);

  const downloadQR = () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#qr-canvas canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `mesa-${qrTable?.number}.png`;
    a.click();
  };

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Mesas</h1>
          <p className="mt-1 text-muted-foreground">Gestioná las mesas y generá códigos QR para tus clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} disabled={branches.length === 0}>
              <Plus className="h-4 w-4" /> Nueva mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar mesa" : "Nueva mesa"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número / Nombre</Label>
                  <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Capacidad</Label>
                  <Input type="number" min={1} value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v: TableStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(statusLabel) as TableStatus[]).map((s) =>
                      <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? "Guardar" : "Crear"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {loading ? (
          <Card className="col-span-full p-10 text-center text-muted-foreground">Cargando...</Card>
        ) : items.length === 0 ? (
          <Card className="col-span-full flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Table2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Sin mesas todavía</h3>
            <p className="text-sm text-muted-foreground">Creá tu primera mesa para empezar a operar.</p>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nueva mesa</Button>
          </Card>
        ) : (
          items.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Mesa</div>
                  <div className="text-2xl font-bold">{t.number}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClasses[t.status]}`}>
                  {statusLabel[t.status]}
                </span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Capacidad: {t.capacity}</div>
              <div className="mt-4 flex flex-wrap gap-1">
                <Button size="sm" variant="secondary" onClick={() => setQrTable(t)}>
                  <QrCode className="h-4 w-4" /> QR
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Dialog open={!!qrTable} onOpenChange={(o) => !o && setQrTable(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Mesa {qrTable?.number}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div id="qr-canvas" className="rounded-xl bg-white p-4">
              {qrUrl && <QRCodeCanvas value={qrUrl} size={240} includeMargin />}
            </div>
            <a href={qrUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 break-all text-xs text-primary underline">
              {qrUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQrTable(null)}>Cerrar</Button>
            <Button onClick={downloadQR}><Download className="h-4 w-4" /> Descargar PNG</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Banknote, Lock, Unlock, Download, Plus } from "lucide-react";

type Method = "cash" | "debit" | "credit" | "transfer" | "mercadopago" | "qr" | "other";
const methodLabel: Record<Method, string> = {
  cash: "Efectivo", debit: "Débito", credit: "Crédito",
  transfer: "Transferencia", mercadopago: "Mercado Pago", qr: "QR", other: "Otro",
};

interface Branch { id: string; name: string; is_main: boolean }
interface Session {
  id: string; branch_id: string; restaurant_id: string;
  status: "open" | "closed"; opened_at: string; closed_at: string | null;
  opening_amount: number; closing_amount: number | null;
  expected_cash: number | null; difference: number | null;
  notes: string | null;
}
interface Payment {
  id: string; method: Method; amount: number; tip: number;
  reference: string | null; status: string;
  created_at: string; order_id: string | null; notes: string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n || 0);

export default function Cash() {
  const { profile, user, roles } = useAuth();
  const canManage = roles.includes("owner") || roles.includes("manager");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [openDlg, setOpenDlg] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [closeDlg, setCloseDlg] = useState(false);
  const [closingAmount, setClosingAmount] = useState("0");
  const [closeNotes, setCloseNotes] = useState("");
  const [payDlg, setPayDlg] = useState(false);
  const [payForm, setPayForm] = useState({ method: "cash" as Method, amount: "", tip: "0", reference: "", notes: "" });

  const loadBranches = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase.from("branches").select("id, name, is_main")
      .eq("restaurant_id", profile.restaurant_id).eq("active", true)
      .order("is_main", { ascending: false });
    const list = (data ?? []) as Branch[];
    setBranches(list);
    if (!branchId && list.length > 0) setBranchId(list[0].id);
  }, [profile?.restaurant_id, branchId]);

  const loadSession = useCallback(async () => {
    if (!branchId) return;
    const { data } = await supabase.from("cash_sessions").select("*")
      .eq("branch_id", branchId).eq("status", "open").maybeSingle();
    const s = (data as Session) ?? null;
    setSession(s);
    if (s) {
      const { data: ps } = await supabase.from("payments").select("*")
        .eq("cash_session_id", s.id).order("created_at", { ascending: false });
      setPayments((ps ?? []) as Payment[]);
    } else {
      setPayments([]);
    }
  }, [branchId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);
  useEffect(() => { loadSession(); }, [loadSession]);

  const openSession = async () => {
    if (!profile?.restaurant_id || !user || !branchId) return;
    const amount = Number(openingAmount) || 0;
    const { error } = await supabase.from("cash_sessions").insert({
      restaurant_id: profile.restaurant_id,
      branch_id: branchId,
      opened_by: user.id,
      opening_amount: amount,
    });
    if (error) return toast.error(error.message);
    toast.success("Turno abierto");
    setOpenDlg(false);
    setOpeningAmount("0");
    loadSession();
  };

  const closeSession = async () => {
    if (!session) return;
    const amount = Number(closingAmount) || 0;
    const { error } = await supabase.rpc("close_cash_session", {
      p_session_id: session.id,
      p_closing_amount: amount,
      p_notes: closeNotes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Turno cerrado");
    setCloseDlg(false);
    setClosingAmount("0");
    setCloseNotes("");
    loadSession();
  };

  const registerPayment = async () => {
    if (!session || !profile?.restaurant_id || !user) return;
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) return toast.error("Ingresá un monto válido");
    const { error } = await supabase.from("payments").insert({
      restaurant_id: profile.restaurant_id,
      branch_id: session.branch_id,
      cash_session_id: session.id,
      method: payForm.method,
      amount,
      tip: Number(payForm.tip) || 0,
      reference: payForm.reference || null,
      notes: payForm.notes || null,
      status: "approved",
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Cobro registrado");
    setPayDlg(false);
    setPayForm({ method: "cash", amount: "", tip: "0", reference: "", notes: "" });
    loadSession();
  };

  const totals = payments.reduce((acc, p) => {
    const v = Number(p.amount) + Number(p.tip ?? 0);
    acc.total += v;
    acc.byMethod[p.method] = (acc.byMethod[p.method] ?? 0) + v;
    return acc;
  }, { total: 0, byMethod: {} as Record<Method, number> });
  const expected = session ? Number(session.opening_amount) + (totals.byMethod.cash ?? 0) : 0;

  const exportCsv = () => {
    if (!session) return;
    const rows: string[] = [
      "fecha,metodo,monto,propina,referencia,notas",
      ...payments.map((p) => [
        new Date(p.created_at).toISOString(),
        methodLabel[p.method],
        Number(p.amount).toFixed(2),
        Number(p.tip ?? 0).toFixed(2),
        (p.reference ?? "").replace(/[,\n]/g, " "),
        (p.notes ?? "").replace(/[,\n]/g, " "),
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `caja-${session.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Caja</h1>
          <p className="mt-1 text-muted-foreground">Turnos, cobros y cierre por sucursal.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sucursal" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!session ? (
        <Card className="mt-6 flex flex-col items-center gap-3 p-12 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">No hay turno abierto en esta sucursal.</p>
          {canManage && (
            <Button onClick={() => setOpenDlg(true)}>
              <Unlock className="h-4 w-4" /> Abrir turno
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Apertura</div>
              <div className="mt-1 text-xl font-bold">{money(Number(session.opening_amount))}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(session.opened_at).toLocaleString("es-AR")}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Cobros totales</div>
              <div className="mt-1 text-xl font-bold">{money(totals.total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{payments.length} movimientos</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Efectivo esperado</div>
              <div className="mt-1 text-xl font-bold">{money(expected)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Apertura + efectivo cobrado</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Acciones</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {canManage && (
                  <>
                    <Button size="sm" onClick={() => setPayDlg(true)}><Plus className="h-4 w-4" /> Cobro</Button>
                    <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
                    <Button size="sm" variant="destructive" onClick={() => { setClosingAmount(String(expected)); setCloseDlg(true); }}>
                      <Lock className="h-4 w-4" /> Cerrar
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </div>

          <Card className="mt-4 p-4">
            <h2 className="mb-3 text-sm font-semibold">Totales por método</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(methodLabel) as Method[]).map((m) => (
                <div key={m} className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{methodLabel[m]}</div>
                  <div className="font-semibold">{money(totals.byMethod[m] ?? 0)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mt-4 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Banknote className="h-4 w-4" /> Movimientos del turno
            </h2>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Sin cobros todavía.</p>
            ) : (
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{methodLabel[p.method]} · {money(Number(p.amount))}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleTimeString("es-AR")}
                        {p.reference ? ` · ${p.reference}` : ""}
                        {p.tip > 0 ? ` · propina ${money(Number(p.tip))}` : ""}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {/* Open session dialog */}
      <Dialog open={openDlg} onOpenChange={setOpenDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Abrir turno de caja</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Monto inicial en caja</Label>
            <Input type="number" inputMode="decimal" value={openingAmount}
              onChange={(e) => setOpeningAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDlg(false)}>Cancelar</Button>
            <Button onClick={openSession}>Abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close session dialog */}
      <Dialog open={closeDlg} onOpenChange={setCloseDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cerrar turno</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between"><span>Efectivo esperado</span><span className="font-semibold">{money(expected)}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Efectivo contado en caja</Label>
              <Input type="number" inputMode="decimal" value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Diferencia: <span className="font-medium">{money(Number(closingAmount) - expected)}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDlg(false)}>Cancelar</Button>
            <Button onClick={closeSession} variant="destructive">Cerrar turno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register payment dialog */}
      <Dialog open={payDlg} onOpenChange={setPayDlg}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar cobro manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={payForm.method} onValueChange={(v: Method) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(methodLabel) as Method[]).map((m) =>
                    <SelectItem key={m} value={m}>{methodLabel[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto</Label>
                <Input type="number" inputMode="decimal" value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Propina</Label>
                <Input type="number" inputMode="decimal" value={payForm.tip}
                  onChange={(e) => setPayForm({ ...payForm, tip: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Referencia (ej: nro de operación)</Label>
              <Input value={payForm.reference}
                onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={payForm.notes}
                onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDlg(false)}>Cancelar</Button>
            <Button onClick={registerPayment}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

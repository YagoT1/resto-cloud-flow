import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, ExternalLink, Building2, User as UserIcon, Link2, Copy, CheckCircle2, XCircle, RefreshCw, ShieldCheck, KeyRound, History, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  plan: string;
  status: string;
  trial_ends_at: string | null;
}

export default function Settings() {
  const { profile, user, refreshProfile, roles } = useAuth();
  const [r, setR] = useState<Restaurant | null>(null);
  const [restoForm, setRestoForm] = useState({ name: "", logo_url: "" });
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [mpStatus, setMpStatus] = useState<{
    webhook_url: string;
    webhook_secret_configured: boolean;
    webhook_secret_source: "per_restaurant" | "env" | null;
    per_restaurant_updated_at: string | null;
    access_token_configured: boolean;
    signature_self_test: boolean;
  } | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const [rotateForm, setRotateForm] = useState({ secret: "", confirm: "", note: "" });
  const [rotating, setRotating] = useState(false);
  const [rotations, setRotations] = useState<Array<{
    id: string; created_at: string; note: string | null; rotated_by: string;
    profiles?: { full_name: string | null; email: string | null } | null;
  }>>([]);
  const canManage = roles.includes("owner") || roles.includes("manager");

  const loadMpStatus = async () => {
    setMpLoading(true);
    const { data, error } = await supabase.functions.invoke("mp-webhook-status");
    setMpLoading(false);
    if (error) return toast.error("No se pudo consultar el estado de Mercado Pago");
    setMpStatus(data as typeof mpStatus);
  };

  const loadRotations = async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase
      .from("mp_secret_rotations")
      .select("id, created_at, note, rotated_by")
      .eq("restaurant_id", profile.restaurant_id)
      .order("created_at", { ascending: false })
      .limit(10);
    setRotations(data ?? []);
  };

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean; message: string; source: string | null; at: string;
  } | null>(null);

  const runHmacTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("mp-webhook-status");
    setTesting(false);
    const at = new Date().toLocaleString();
    if (error || !data) {
      setTestResult({ ok: false, message: "No se pudo contactar al servicio de verificación.", source: null, at });
      return;
    }
    const s = data as NonNullable<typeof mpStatus>;
    setMpStatus(s);
    const src = s.webhook_secret_source === "per_restaurant" ? "por restaurante"
      : s.webhook_secret_source === "env" ? "global" : null;
    if (!s.webhook_secret_configured) {
      setTestResult({ ok: false, message: "No hay clave secreta configurada.", source: src, at });
    } else if (s.signature_self_test) {
      setTestResult({ ok: true, message: "La firma HMAC-SHA256 se generó y verificó correctamente.", source: src, at });
    } else {
      setTestResult({ ok: false, message: "La verificación de firma falló. Revisá la clave guardada.", source: src, at });
    }
  };

  const rotateSecret = async () => {
    if (rotateForm.secret.length < 16) {
      return toast.error("La clave debe tener al menos 16 caracteres");
    }
    if (rotateForm.secret !== rotateForm.confirm) {
      return toast.error("Las claves no coinciden");
    }
    setRotating(true);
    const { error } = await supabase.functions.invoke("mp-set-webhook-secret", {
      body: { secret: rotateForm.secret, note: rotateForm.note || null },
    });
    setRotating(false);
    if (error) return toast.error("No se pudo rotar la clave");
    toast.success("Clave actualizada correctamente");
    setRotateForm({ secret: "", confirm: "", note: "" });
    loadRotations();
    await runHmacTest();
  };

  const load = async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase.from("restaurants").select("*")
      .eq("id", profile.restaurant_id).maybeSingle();
    if (data) {
      setR(data as Restaurant);
      setRestoForm({ name: data.name, logo_url: data.logo_url ?? "" });
    }
    const { data: p } = await supabase.from("profiles").select("full_name, phone")
      .eq("id", user!.id).maybeSingle();
    setProfileForm({ full_name: p?.full_name ?? "", phone: p?.phone ?? "" });
  };

  useEffect(() => { if (profile && user) load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id, user?.id]);
  useEffect(() => { if (canManage) { loadMpStatus(); loadRotations(); } /* eslint-disable-next-line */ }, [canManage, profile?.restaurant_id]);

  const saveRestaurant = async () => {
    if (!r) return;
    setSaving(true);
    const { error } = await supabase.from("restaurants")
      .update({ name: restoForm.name.trim(), logo_url: restoForm.logo_url.trim() || null })
      .eq("id", r.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Datos del restaurante actualizados");
    load();
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ full_name: profileForm.full_name.trim() || null, phone: profileForm.phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    refreshProfile();
  };

  const publicUrl = r ? `${window.location.origin}/m/${r.slug}` : "";

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="text-3xl font-bold">Configuración</h1>
      <p className="mt-1 text-muted-foreground">Datos del restaurante, perfil y conexiones futuras.</p>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Restaurante</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={restoForm.name} onChange={(e) => setRestoForm({ ...restoForm, name: e.target.value })} disabled={!canManage} />
          </div>
          <div className="space-y-2">
            <Label>Logo (URL)</Label>
            <Input value={restoForm.logo_url} placeholder="https://..."
              onChange={(e) => setRestoForm({ ...restoForm, logo_url: e.target.value })} disabled={!canManage} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Enlace público del menú</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={publicUrl} className="flex-1" />
              <Button variant="secondary" asChild>
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir
                </a>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plan actual</Label>
            <Input readOnly value={r?.plan ?? ""} className="capitalize" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input readOnly value={r?.status ?? ""} className="capitalize" />
          </div>
        </div>
        {canManage && (
          <div className="mt-6 flex justify-end">
            <Button onClick={saveRestaurant} disabled={saving}><Save className="h-4 w-4" /> Guardar</Button>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Mi perfil</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Email</Label>
            <Input readOnly value={user?.email ?? ""} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={saveProfile} disabled={saving}><Save className="h-4 w-4" /> Guardar</Button>
        </div>
      </Card>

      {canManage && (
        <Card className="mt-6 p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Mercado Pago · Webhook</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Copiá esta URL en el panel de Mercado Pago (Tus integraciones → Webhooks) y pegá allí la misma
            clave secreta que guardaste en tu backend. Validamos cada notificación con HMAC-SHA256; las
            firmas inválidas se rechazan con 401.
          </p>

          <div className="mt-4 space-y-2">
            <Label>URL de notificación</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={mpStatus?.webhook_url ?? ""} className="flex-1 font-mono text-xs" />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!mpStatus?.webhook_url) return;
                  navigator.clipboard.writeText(mpStatus.webhook_url);
                  toast.success("URL copiada");
                }}
                disabled={!mpStatus?.webhook_url}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <StatusRow
              label="Access Token configurado"
              ok={!!mpStatus?.access_token_configured}
            />
            <StatusRow
              label="Clave secreta del webhook configurada"
              ok={!!mpStatus?.webhook_secret_configured}
            />
            <StatusRow
              label="Validación de firma HMAC funcionando"
              ok={!!mpStatus?.signature_self_test}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              La clave secreta se guarda de forma cifrada en el backend. Nunca se expone al navegador.
            </p>
            <Button variant="ghost" size="sm" onClick={loadMpStatus} disabled={mpLoading}>
              <RefreshCw className={`h-4 w-4 ${mpLoading ? "animate-spin" : ""}`} /> Revalidar
            </Button>
          </div>

          <div className="mt-6 border-t pt-6">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Reemplazar clave secreta</h3>
              {mpStatus?.webhook_secret_source && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Fuente actual:{" "}
                  {mpStatus.webhook_secret_source === "per_restaurant" ? "por restaurante" : "global"}
                  {mpStatus.per_restaurant_updated_at && mpStatus.webhook_secret_source === "per_restaurant" && (
                    <> · {new Date(mpStatus.per_restaurant_updated_at).toLocaleString()}</>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Generá una nueva clave en el panel de Mercado Pago y pegala acá. Se guarda cifrada con
              AES-GCM en la base y se registra en auditoría. Nunca la mostramos de vuelta.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nueva clave</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={rotateForm.secret}
                  onChange={(e) => setRotateForm({ ...rotateForm, secret: e.target.value })}
                  placeholder="Mín. 16 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar clave</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={rotateForm.confirm}
                  onChange={(e) => setRotateForm({ ...rotateForm, confirm: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={rotateForm.note}
                  maxLength={500}
                  placeholder="Ej: rotación trimestral"
                  onChange={(e) => setRotateForm({ ...rotateForm, note: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={runHmacTest} disabled={testing || rotating}>
                <ShieldCheck className={`h-4 w-4 ${testing ? "animate-pulse" : ""}`} />
                {testing ? "Probando..." : "Probar firma HMAC"}
              </Button>
              <Button onClick={rotateSecret} disabled={rotating || !rotateForm.secret}>
                <KeyRound className="h-4 w-4" /> {rotating ? "Guardando..." : "Rotar clave"}
              </Button>
            </div>
            {testResult && (
              <div
                role="status"
                aria-live="polite"
                className={`mt-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${
                  testResult.ok
                    ? "border-success/40 bg-success/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                {testResult.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <div>
                  <div className="font-medium">
                    {testResult.ok ? "Auto-test aprobado" : "Auto-test fallido"}
                  </div>
                  <div className="text-muted-foreground">{testResult.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {testResult.source && <>Clave: {testResult.source} · </>}{testResult.at}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 border-t pt-6">
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Historial de rotaciones</h3>
            </div>
            {rotations.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay rotaciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {rotations.map((row) => (
                  <div key={row.id} className="flex items-start justify-between rounded-lg border bg-muted/30 p-3 text-sm">
                    <div>
                      <div className="font-medium">{new Date(row.created_at).toLocaleString()}</div>
                      {row.note && <div className="text-xs text-muted-foreground">{row.note}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.rotated_by === user?.id ? "vos" : row.rotated_by.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t pt-6">
            <div className="mb-3 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Guía: validar la integración de punta a punta</h3>
            </div>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Configurá el webhook en Mercado Pago.</span>{" "}
                En el panel de desarrolladores (Tus integraciones → Webhooks), pegá la URL de notificación
                de arriba, elegí el evento <span className="font-mono text-xs">Pagos</span> y guardá la misma
                clave secreta que rotaste acá.
              </li>
              <li>
                <span className="font-medium text-foreground">Verificá la firma.</span>{" "}
                Usá el botón "Probar firma HMAC": si el auto-test sale en verde, el backend está validando
                las firmas con tu clave actual.
              </li>
              <li>
                <span className="font-medium text-foreground">Enviá un pago de prueba.</span>{" "}
                Desde el panel de Mercado Pago usá "Simular notificación" / "Probar webhook" contra la URL,
                o generá un pago real con las tarjetas de prueba en modo sandbox.
              </li>
              <li>
                <span className="font-medium text-foreground">Comprobá el pedido.</span>{" "}
                Andá a la sección Pedidos: el pedido asociado debe mostrar el estado de pago actualizado
                (Aprobado / Pendiente / Rechazado) apenas llega la notificación.
              </li>
              <li>
                <span className="font-medium text-foreground">Mirá cocina en tiempo real.</span>{" "}
                Con la pantalla de Cocina (KDS) abierta, el pedido debe aparecer o cambiar de estado sin
                recargar la página. Si no se mueve, revisá que Realtime esté activo.
              </li>
              <li>
                <span className="font-medium text-foreground">Reintentos y duplicados.</span>{" "}
                Si Mercado Pago reintenta la misma notificación, el sistema la detecta por payment_id y no
                duplica el registro. Los fallos de firma quedan visibles como alertas para Dueños y Gerentes.
              </li>
            </ol>
          </div>
        </Card>
      )}

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integraciones</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Próximamente: WhatsApp Business, impresoras térmicas y facturación electrónica AFIP.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["WhatsApp Business", "Impresora térmica", "AFIP Facturación"].map((x) => (
            <div key={x} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
              <span>{x}</span>
              <span className="text-xs text-muted-foreground">Próximamente</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
      <span>{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> OK
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
          <XCircle className="h-4 w-4" /> Falta
        </span>
      )}
    </div>
  );
}

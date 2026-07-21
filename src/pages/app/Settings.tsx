import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, ExternalLink, Building2, User as UserIcon, Link2, Copy, CheckCircle2, XCircle, RefreshCw, ShieldCheck } from "lucide-react";
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
    access_token_configured: boolean;
    signature_self_test: boolean;
  } | null>(null);
  const [mpLoading, setMpLoading] = useState(false);
  const canManage = roles.includes("owner") || roles.includes("manager");

  const loadMpStatus = async () => {
    setMpLoading(true);
    const { data, error } = await supabase.functions.invoke("mp-webhook-status");
    setMpLoading(false);
    if (error) return toast.error("No se pudo consultar el estado de Mercado Pago");
    setMpStatus(data as typeof mpStatus);
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
  useEffect(() => { if (canManage) loadMpStatus(); /* eslint-disable-next-line */ }, [canManage]);

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

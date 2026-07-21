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

      <Card className="mt-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Integraciones</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Próximamente: Mercado Pago, WhatsApp Business, impresoras térmicas y facturación electrónica AFIP.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["Mercado Pago", "WhatsApp Business", "Impresora térmica", "AFIP Facturación"].map((x) => (
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

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Role = "owner" | "manager" | "waiter" | "kitchen" | "cashier";
const roleLabel: Record<Role, string> = {
  owner: "Dueño", manager: "Encargado", waiter: "Mozo", kitchen: "Cocina", cashier: "Caja",
};
const allRoles: Role[] = ["owner", "manager", "waiter", "kitchen", "cashier"];

interface Member {
  user_id: string;
  role_id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
}

export default function Team() {
  const { profile, user, roles } = useAuth();
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = roles.includes("owner") || roles.includes("manager");

  const load = async () => {
    if (!profile?.restaurant_id) return;
    setLoading(true);
    const { data: r } = await supabase
      .from("user_roles")
      .select("id, role, user_id")
      .eq("restaurant_id", profile.restaurant_id);
    const ids = Array.from(new Set((r ?? []).map((x) => x.user_id)));
    const { data: ps } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const profileMap = new Map((ps ?? []).map((p) => [p.id, p]));
    const merged: Member[] = (r ?? []).map((x: { id: string; role: Role; user_id: string }) => ({
      role_id: x.id,
      role: x.role,
      user_id: x.user_id,
      full_name: profileMap.get(x.user_id)?.full_name ?? null,
      email: profileMap.get(x.user_id)?.email ?? null,
    }));
    setItems(merged);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.restaurant_id]);

  const changeRole = async (m: Member, role: Role) => {
    if (role === m.role) return;
    const { error } = await supabase.from("user_roles").update({ role }).eq("id", m.role_id);
    if (error) return toast.error(error.message);
    toast.success("Rol actualizado");
    load();
  };

  const remove = async (m: Member) => {
    if (m.user_id === user?.id) return toast.error("No podés quitarte a vos mismo");
    if (!confirm(`¿Quitar a ${m.full_name ?? m.email} del equipo?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", m.role_id);
    if (error) return toast.error(error.message);
    toast.success("Miembro removido");
    load();
  };

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Equipo</h1>
          <p className="mt-1 text-muted-foreground">Gestioná los usuarios y sus roles dentro de tu restaurante.</p>
        </div>
      </div>

      <Card className="mt-6 border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <ShieldCheck className="h-4 w-4" /> Invitaciones por email
        </p>
        <p className="mt-1">
          Los nuevos miembros pueden registrarse en{" "}
          <code className="rounded bg-background px-1">/auth</code> con el nombre exacto de tu restaurante.
          Próximamente: invitaciones por email con un solo click.
        </p>
      </Card>

      <Card className="mt-6 divide-y">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Sin miembros</h3>
          </div>
        ) : (
          items.map((m) => (
            <div key={m.role_id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-white">
                {(m.full_name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {m.full_name ?? "Sin nombre"}
                  {m.user_id === user?.id && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Vos</span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">{m.email}</div>
              </div>
              <Select
                value={m.role}
                onValueChange={(v: Role) => changeRole(m, v)}
                disabled={!canManage || m.user_id === user?.id}
              >
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon" variant="ghost"
                onClick={() => remove(m)}
                disabled={!canManage || m.user_id === user?.id}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Utensils, ShieldCheck } from "lucide-react";

// The @supabase/supabase-js oauth namespace is beta and may not be fully typed.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: RedirectResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: RedirectResult | null; error: { message: string } | null }>;
};
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; redirect_uris?: string[] };
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type RedirectResult = { redirect_url?: string; redirect_to?: string };

function oauth(): OAuthApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthApi;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta el parámetro authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setAccount(sess.session.user.email ?? sess.session.user.id);
      try {
        const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar la autorización.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      const api = oauth();
      const { data, error } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("El servidor de autorización no devolvió una URL de redirección.");
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Error al procesar la decisión.");
    }
  };

  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : []);
  const clientName = details?.client?.name ?? "una aplicación externa";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 shadow-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand">
            <Utensils className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">RestoCloud</div>
            <div className="text-base font-semibold">Autorización de acceso</div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && !details && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!error && details && (
          <>
            <h1 className="text-xl font-bold">Conectar {clientName} a tu cuenta</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Esto permite que <strong>{clientName}</strong> use RestoCloud actuando como vos.
            </p>
            {account && (
              <p className="mt-4 text-sm">
                Sesión iniciada como <strong>{account}</strong>.
              </p>
            )}

            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  Podrá invocar las herramientas MCP habilitadas de esta app mientras estés autenticado.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  El aislamiento por restaurante y sucursal (RLS) sigue vigente: nunca accede a datos
                  de otros tenants.
                </span>
              </div>
              {scopes.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-medium text-muted-foreground">Permisos solicitados</div>
                  <ul className="mt-1 list-disc pl-5">
                    {scopes.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Denegar
              </Button>
              <Button
                className="flex-1 bg-gradient-brand hover:opacity-95"
                disabled={busy}
                onClick={() => decide(true)}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aprobar
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

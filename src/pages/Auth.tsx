import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Utensils, ArrowLeft } from "lucide-react";

export default function Auth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");

  // Preserve `?next=` so OAuth consent (and any other flow) returns to the exact URL.
  const rawNext = params.get("next");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const redirectTarget = safeNext ?? "/app";
  const absoluteRedirect = `${window.location.origin}${redirectTarget}`;

  useEffect(() => {
    if (user) navigate(redirectTarget, { replace: true });
  }, [user, navigate, redirectTarget]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: absoluteRedirect,
            data: { full_name: fullName, restaurant_name: restaurantName },
          },
        });
        if (error) throw error;
        toast.success("¡Restaurante creado! Bienvenido a RestoCloud.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("¡Bienvenido de vuelta!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(msg.includes("Invalid login") ? "Email o contraseña incorrectos" : msg);
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: absoluteRedirect },
    });
  };


  return (
    <div className="flex min-h-screen bg-background">
      {/* left brand */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-dark p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gradient-brand opacity-30 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
            <Utensils className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">RestoCloud</span>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">
            "Migramos 4 sucursales en una tarde y ya no perdimos un pedido más."
          </h2>
          <p className="mt-4 text-white/60">— Martina G., dueña de La Trattoria</p>
        </div>
        <div className="relative text-sm text-white/50">© {new Date().getFullYear()} RestoCloud</div>
      </div>

      {/* right form */}
      <div className="flex flex-1 flex-col">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Inicio
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <Card className="w-full max-w-md border-border/60 p-8 shadow-md">
            <div className="mb-8">
              <h1 className="text-3xl font-bold">{mode === "signup" ? "Crear mi restaurante" : "Bienvenido de vuelta"}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signup" ? "14 días gratis. Sin tarjeta. Cancelá cuando quieras." : "Ingresá a tu panel de RestoCloud."}
              </p>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={signInGoogle}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
              Continuar con Google
            </Button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">o con email</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="restaurant">Nombre del restaurante</Label>
                    <Input id="restaurant" required value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="La Trattoria" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Tu nombre</Label>
                    <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Martina González" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@restaurante.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-gradient-brand shadow-md hover:opacity-95">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Crear mi restaurante" : "Ingresar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
              <button onClick={() => setMode(mode === "signup" ? "signin" : "signup")} className="font-medium text-primary hover:underline">
                {mode === "signup" ? "Ingresar" : "Crear restaurante"}
              </button>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

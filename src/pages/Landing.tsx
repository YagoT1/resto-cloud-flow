import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChefHat, QrCode, Smartphone, BarChart3, Printer, Wallet,
  Store, Users, Zap, Shield, ArrowRight, Check, Utensils
} from "lucide-react";
import hero from "@/assets/hero.jpg";

const features = [
  { icon: QrCode, title: "Menú con QR", desc: "Tus clientes piden desde la mesa sin descargar nada." },
  { icon: ChefHat, title: "Comanda en cocina", desc: "Pantalla KDS en tiempo real con tickets ordenados." },
  { icon: Store, title: "Multi sucursal", desc: "Operá todas tus sucursales desde un solo panel." },
  { icon: BarChart3, title: "Reportes en vivo", desc: "Ventas, productos top y cierre de caja al instante." },
  { icon: Wallet, title: "Mercado Pago", desc: "Cobrá con QR, link de pago o tarjeta — listo para integrar." },
  { icon: Printer, title: "Impresión térmica", desc: "Compatible con impresoras 58/80mm, USB o red." },
];

const plans = [
  { name: "Starter", price: "$0", period: "14 días gratis", desc: "Probá toda la plataforma sin tarjeta.",
    features: ["1 sucursal", "Menú QR ilimitado", "Pedidos en vivo", "Soporte por email"], cta: "Empezar gratis" },
  { name: "Pro", price: "$29", period: "/ mes por sucursal", desc: "Para restaurantes que crecen.", highlight: true,
    features: ["Sucursales ilimitadas", "KDS + Caja", "Reportes avanzados", "Mercado Pago + WhatsApp", "Soporte prioritario"], cta: "Probar Pro" },
  { name: "Enterprise", price: "A medida", period: "facturación AFIP", desc: "Cadenas y franquicias.",
    features: ["SLA dedicado", "Integraciones a medida", "API + Webhooks", "Onboarding asistido"], cta: "Hablar con ventas" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
              <Utensils className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">RestoCloud</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Funciones</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Precios</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Ingresar</Link></Button>
            <Button asChild size="sm" className="bg-gradient-brand shadow-md hover:opacity-90">
              <Link to="/auth?mode=signup">Probar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="container grid gap-12 py-20 md:grid-cols-2 md:py-32">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              Nuevo: Comanda en cocina en tiempo real
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.05] md:text-6xl lg:text-7xl">
              El sistema operativo de tu <span className="text-gradient-brand">restaurante</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Gestioná menú, mesas, pedidos QR, cocina, caja y reportes desde una sola plataforma multi-sucursal pensada para Argentina.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-brand shadow-brand hover:opacity-95">
                <Link to="/auth?mode=signup">Empezar 14 días gratis <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline"><a href="#features">Ver demo</a></Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Sin tarjeta</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Setup en 2 minutos</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Soporte en español</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-brand opacity-20 blur-3xl" />
            <img src={hero} alt="Panel RestoCloud sobre mesa de restaurante" className="relative rounded-3xl border border-border shadow-brand" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold md:text-5xl">Todo lo que tu salón necesita</h2>
          <p className="mt-4 text-muted-foreground">Una plataforma única, integrada y simple. Sin licencias por puesto, sin equipos extra.</p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="group relative overflow-hidden border-border/60 p-7 transition hover:border-primary/40 hover:shadow-md">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-gradient-brand group-hover:text-white">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border bg-gradient-dark text-white">
        <div className="container grid gap-8 py-16 md:grid-cols-4">
          {[
            { k: "+1.200", v: "restaurantes activos" },
            { k: "98%", v: "uptime garantizado" },
            { k: "3 seg", v: "alta de un producto" },
            { k: "24/7", v: "soporte en español" },
          ].map((s) => (
            <div key={s.v}>
              <div className="text-4xl font-bold text-gradient-brand">{s.k}</div>
              <div className="mt-1 text-sm text-white/60">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold md:text-5xl">Planes simples y transparentes</h2>
          <p className="mt-4 text-muted-foreground">Pagás por sucursal activa. Cancelá cuando quieras.</p>
        </div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.name} className={`relative flex flex-col p-8 ${p.highlight ? "border-primary shadow-brand" : "border-border/60"}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-brand px-3 py-1 text-xs font-medium text-white shadow-md">
                  Más elegido
                </div>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild className={`mt-8 ${p.highlight ? "bg-gradient-brand hover:opacity-95" : ""}`} variant={p.highlight ? "default" : "outline"}>
                <Link to="/auth?mode=signup">{p.cta}</Link>
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-dark p-12 text-white md:p-20">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-brand opacity-30 blur-3xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-4xl font-bold md:text-5xl">Empezá hoy. Cobrá mejor mañana.</h2>
            <p className="mt-4 text-white/70">Activá tu restaurante en menos de 2 minutos. Sin tarjeta. Sin instalaciones.</p>
            <Button asChild size="lg" className="mt-8 bg-gradient-brand shadow-brand hover:opacity-95">
              <Link to="/auth?mode=signup">Crear mi restaurante <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-card">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 md:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-brand">
              <Utensils className="h-3.5 w-3.5 text-white" />
            </div>
            © {new Date().getFullYear()} RestoCloud — Hecho en Argentina 🧉
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Términos</a>
            <a href="#" className="hover:text-foreground">Privacidad</a>
            <a href="#" className="hover:text-foreground">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

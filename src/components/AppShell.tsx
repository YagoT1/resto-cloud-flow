import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard, UtensilsCrossed, Tags, Table2, ClipboardList,
  ChefHat, Store, Users, Settings, LogOut, Utensils, Menu as MenuIcon, X, BarChart3, Banknote
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const nav = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/app/orders", icon: ClipboardList, label: "Pedidos" },
  { to: "/app/kitchen", icon: ChefHat, label: "Cocina" },
  { to: "/app/cash", icon: Banknote, label: "Caja" },
  { to: "/app/tables", icon: Table2, label: "Mesas" },
  { to: "/app/menu", icon: UtensilsCrossed, label: "Menú" },
  { to: "/app/categories", icon: Tags, label: "Categorías" },
  { to: "/app/branches", icon: Store, label: "Sucursales" },
  { to: "/app/team", icon: Users, label: "Equipo" },
  { to: "/app/reports", icon: BarChart3, label: "Reportes" },
  { to: "/app/settings", icon: Settings, label: "Configuración" },
];

export default function AppShell() {
  const { profile, signOut, roles } = useAuth();
  const [open, setOpen] = useState(false);

  const SidebarBody = () => (
    <>
      <Link to="/app" className="flex items-center gap-2 px-2 py-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand">
          <Utensils className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-sidebar-foreground">RestoCloud</div>
          <div className="text-xs text-sidebar-foreground/60">{roles[0] ?? "owner"}</div>
        </div>
      </Link>
      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border pt-4">
        <div className="mb-3 px-2">
          <div className="truncate text-sm font-medium text-sidebar-foreground">{profile?.full_name ?? "Usuario"}</div>
          <div className="truncate text-xs text-sidebar-foreground/60">{profile?.email}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-4 lg:flex">
        <SidebarBody />
      </aside>

      {/* mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-sidebar p-4">
            <SidebarBody />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Utensils className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">RestoCloud</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

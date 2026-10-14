import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Compass,
  Home,
  Library,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/segmentos", label: "Segmentos", icon: Users },
  { to: "/escenarios", label: "Escenarios 2030", icon: TrendingUp },
  { to: "/acciones", label: "Acciones", icon: Target },
  { to: "/metodologia", label: "Metodología", icon: BookOpen },
  { to: "/fuentes", label: "Fuentes", icon: Library },
] as const;

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-teal text-sm font-extrabold text-teal-foreground" aria-hidden>
        N
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-extrabold tracking-tight">NEXO MX 2030</p>
          <p className="truncate text-[11px] text-rail-muted">Observatorio de comercio digital</p>
        </div>
      )}
    </div>
  );
}

export function NavLinks({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          title={collapsed ? label : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-rail-foreground transition-colors hover:bg-rail-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-0",
          )}
          activeProps={{ className: "bg-rail-active text-primary-foreground [&>svg]:text-teal" }}
        >
          <Icon className="size-[18px] shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function NavigationRail({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col bg-rail text-rail-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center px-4", collapsed && "justify-center px-0")}>
        <Brand compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <NavLinks collapsed={collapsed} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <p className="px-2 pb-2 text-[11px] leading-snug text-rail-muted">
            Proyecto independiente. No es un sitio oficial del gobierno.
          </p>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md px-3 text-xs text-rail-muted hover:bg-rail-active hover:text-rail-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Contraer"}
        </button>
      </div>
    </aside>
  );
}

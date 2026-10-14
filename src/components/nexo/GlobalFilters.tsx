import { useQuery } from "@tanstack/react-query";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { filterOptionsQuery } from "@/lib/queries";
import { useGlobalFilters, type GlobalFilterState } from "./filters-context";
import { cn } from "@/lib/utils";

type Def = {
  key: keyof GlobalFilterState;
  label: string;
  options: { value: string; label: string }[];
  pending?: boolean;
};

function useDefs(): Def[] {
  const { data } = useQuery(filterOptionsQuery());
  const seg = data?.segments ?? {};
  const toOpts = (vals: string[] | undefined) => (vals ?? []).filter((v) => v !== "Total").map((v) => ({ value: v, label: v }));
  const income = [...(seg["income_decile"] ?? [])].sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  return [
    { key: "year", label: "Año", options: (data?.years ?? []).map((y) => ({ value: String(y), label: String(y) })) },
    { key: "geo_code", label: "Entidad", options: (data?.geographies ?? []).map((g) => ({ value: g.geo_code, label: g.geo_name })) },
    { key: "area", label: "Ámbito", options: toOpts(seg["area"]) },
    { key: "sex", label: "Sexo", options: toOpts(seg["sex"]) },
    { key: "age_group", label: "Edad", options: toOpts(seg["age_group"]) },
    { key: "schooling", label: "Escolaridad", options: toOpts(seg["schooling"]), pending: !seg["schooling"]?.length },
    { key: "income_decile", label: "Ingreso imputado", options: toOpts(income), pending: income.length === 0 },
  ];
}

function display(def: Def, v: GlobalFilterState[keyof GlobalFilterState]) {
  if (v == null) return null;
  return def.options.find((o) => o.value === String(v))?.label ?? String(v);
}

function OptionList({ def, onPick }: { def: Def; onPick: (v: string | null) => void }) {
  const { filters } = useGlobalFilters();
  const current = filters[def.key];
  if (def.pending)
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Pendiente de carga. {def.key === "income_decile" ? "El decil se imputa emparejando ENDUTIH con ENIGH. Aparece cuando esa carga ya está en la base." : "Requiere microdatos ENDUTIH."}
      </p>
    );
  if (!def.options.length) return <p className="p-3 text-sm text-muted-foreground">Cargando opciones…</p>;
  return (
    <div className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label={def.label}>
      <button
        type="button"
        className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
        onClick={() => onPick(null)}
      >
        Todos
      </button>
      {def.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="option"
          aria-selected={String(current) === o.value}
          className={cn(
            "w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
            String(current) === o.value && "bg-accent font-semibold text-accent-foreground",
          )}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterChip({ def }: { def: Def }) {
  const { filters, setFilter } = useGlobalFilters();
  const v = display(def, filters[def.key]);
  const set = (val: string | null) =>
    setFilter(def.key, (def.key === "year" && val ? Number(val) : val) as never);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            v ? "border-teal bg-teal-soft text-accent-foreground" : "bg-card hover:bg-muted",
            def.pending && "border-dashed text-muted-foreground",
          )}
        >
          {def.label}
          {v && <span className="font-semibold">: {v}</span>}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionList def={def} onPick={set} />
      </PopoverContent>
    </Popover>
  );
}

export function GlobalFilters({ className }: { className?: string }) {
  const defs = useDefs();
  const { activeCount, reset, filters, setFilter } = useGlobalFilters();
  return (
    <>
      {/* Desktop / tablet chips */}
      <div className={cn("hidden min-w-0 flex-wrap items-center gap-1.5 md:flex", className)} aria-label="Filtros globales">
        {defs.map((d) => (
          <FilterChip key={d.key} def={d} />
        ))}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={reset}>
            <X aria-hidden /> Limpiar
          </Button>
        )}
      </div>
      {/* Mobile drawer */}
      <Drawer>
        <DrawerTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full md:hidden">
            <SlidersHorizontal aria-hidden /> Filtros{activeCount > 0 && ` (${activeCount})`}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>Filtros globales</DrawerTitle>
            <DrawerDescription>Se aplican a las preguntas y vistas analíticas.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-6">
            {defs.map((d) => (
              <div key={d.key}>
                <p className="mb-1 text-sm font-semibold">{d.label}</p>
                {d.pending ? (
                  <p className="text-sm text-muted-foreground">Pendiente de carga</p>
                ) : (
                  <select
                    className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                    value={filters[d.key] == null ? "" : String(filters[d.key])}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setFilter(d.key, (d.key === "year" && val ? Number(val) : val) as never);
                    }}
                    aria-label={d.label}
                  >
                    <option value="">Todos</option>
                    {d.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
            {activeCount > 0 && (
              <Button variant="outline" className="w-full" onClick={reset}>
                Limpiar filtros
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { EmptyState } from "@/components/nexo/states";
import { Input } from "@/components/ui/input";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { sourcesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fuentes")({
  head: () => headFor("Fuentes", "Catálogo buscable de fuentes oficiales con estado de carga, año, universo y enlace al documento original."),
  loader: ({ context }) => context.queryClient.ensureQueryData(sourcesQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Fuentes,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  curated_included: { label: "Datos cargados", cls: "bg-teal-soft text-accent-foreground" },
  metadata_included: { label: "Metadatos cargados", cls: "bg-secondary text-secondary-foreground" },
  pending_download: { label: "Pendiente de carga", cls: "bg-warning-soft text-warning-foreground" },
  archived: { label: "Archivado", cls: "bg-muted text-muted-foreground" },
};

function Fuentes() {
  const { data } = useSuspenseQuery(sourcesQuery());
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? data.filter((d) => [d.source_name, d.title, d.purpose ?? "", d.resource_type ?? ""].join(" ").toLowerCase().includes(t)) : data;
  }, [q, data]);
  return (
    <AppShell>
      <PageScroll title="Fuentes" description="Documentos y bases oficiales usados o previstos. Este proyecto no es un sitio oficial.">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fuente, encuesta o tipo…" className="pl-9" aria-label="Buscar fuentes" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{list.length} fuentes</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {list.length === 0 && <div className="md:col-span-2"><EmptyState title="Sin coincidencias" description="Prueba con otro término." /></div>}
          {list.map((s) => {
            const st = STATUS[s.status] ?? { label: "Pendiente de carga", cls: "bg-warning-soft text-warning-foreground" };
            return (
              <article key={s.id} className="flex flex-col rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.source_name}</h2>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>{st.label}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.purpose}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="font-semibold">Año</dt><dd className="text-muted-foreground">{s.year ?? "No especificado"}</dd>
                  <dt className="font-semibold">Tipo</dt><dd className="text-muted-foreground">{s.resource_type ?? "—"} · {s.tier === "core" ? "Núcleo" : "Extendida"}</dd>
                  <dt className="font-semibold">Universo</dt><dd className="text-muted-foreground">{s.universes.length ? s.universes.join("; ") : "Sin estimaciones cargadas"}</dd>
                  <dt className="font-semibold">Estimaciones</dt><dd className="tabular text-muted-foreground">{s.estimate_count}</dd>
                </dl>
                <a href={s.official_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-foreground underline-offset-4 hover:underline">
                  Enlace oficial <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </article>
            );
          })}
        </div>
      </PageScroll>
    </AppShell>
  );
}

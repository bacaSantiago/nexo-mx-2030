import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { EmptyState } from "@/components/nexo/states";
import { ObservedBadge } from "@/components/nexo/badges";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { interventionsQuery } from "@/lib/queries";
import type { InterventionItem } from "@/lib/analytics/types";

export const Route = createFileRoute("/acciones")({
  head: () => headFor("Acciones", "Portafolio de intervenciones para la inclusión en comercio digital con puntaje transparente por alcance, efecto modelado, equidad, factibilidad y costo."),
  loader: ({ context }) => context.queryClient.ensureQueryData(interventionsQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Acciones,
});

const CRITERIA: { key: keyof InterventionItem["scores"][number]; label: string; desc: string }[] = [
  { key: "reach", label: "Alcance", desc: "Personas del segmento afectadas por la barrera" },
  { key: "modeled_uplift", label: "Efecto modelado", desc: "Aumento estimado en compra digital (modelado)" },
  { key: "equity", label: "Equidad", desc: "Peso a grupos con mayor rezago" },
  { key: "feasibility", label: "Factibilidad", desc: "Capacidad de implementación de actores" },
  { key: "relative_cost", label: "Costo relativo", desc: "Menor costo, mayor puntaje" },
];

function ScoreBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">Pendiente de carga</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>
      <span className="tabular text-xs">{value.toFixed(2)}</span>
    </div>
  );
}

function Acciones() {
  const { data } = useSuspenseQuery(interventionsQuery());
  return (
    <AppShell>
      <PageScroll title="Acciones" description="Intervenciones por barrera, con puntaje transparente. Los puntajes son modelados y no implican causalidad probada.">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Cómo se calcula el puntaje de prioridad</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {CRITERIA.map((c) => (
              <li key={c.key} className="rounded-md bg-muted p-3">
                <p className="text-sm font-semibold">{c.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Ponderaciones y versión del modelo se publicarán junto con los resultados.</p>
        </section>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.length === 0 && (
            <div className="lg:col-span-2">
              <EmptyState description="El portafolio de intervenciones y sus puntajes se cargarán tras la revisión del modelo de priorización." />
            </div>
          )}
          {data.map((i) => (
            <article key={i.intervention_code} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold">{i.intervention_name}</h3>
                <ObservedBadge value="modeled" />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>
              <p className="mt-2 text-xs"><strong>Actores:</strong> {i.implementation_actors.join(", ") || "—"}</p>
              <div className="mt-3 space-y-2">
                {CRITERIA.map((c) => (
                  <div key={c.key} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs">
                    <span>{c.label}</span>
                    <ScoreBar value={(i.scores[0]?.[c.key] as number | null) ?? null} />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </PageScroll>
    </AppShell>
  );
}

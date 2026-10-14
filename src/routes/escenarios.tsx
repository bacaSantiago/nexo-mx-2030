import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { BarList } from "@/components/nexo/charts";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { EmptyState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { scenarioQuery } from "@/lib/queries";

export const Route = createFileRoute("/escenarios")({
  head: () => headFor("Escenarios 2030", "Escenarios de adopción del comercio digital a 2030 como rangos bajo supuestos explícitos, no pronósticos oficiales."),
  loader: ({ context }) => context.queryClient.ensureQueryData(scenarioQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Escenarios,
});

const PLACEHOLDERS = ["Tendencial", "Inclusión acelerada", "Rezago territorial"];

function Escenarios() {
  const { data } = useSuspenseQuery(scenarioQuery());
  const defs = data.definitions.length ? data.definitions : null;
  return (
    <AppShell>
      <PageScroll title="Escenarios 2030" description="Rangos bajo supuestos explícitos (p10–p90). No son pronósticos oficiales.">
        <div className="grid gap-3 md:grid-cols-3">
          {(defs ?? PLACEHOLDERS.map((n) => ({ scenario_code: n, scenario_name: n, description: "" }))).map((d) => {
            const rows = data.evidence.rows.filter((r) => r.label === d.scenario_code);
            return (
              <article key={d.scenario_code} className="rounded-lg border bg-card p-4">
                <TrendingUp className="size-5 text-teal" aria-hidden />
                <h3 className="mt-2 font-bold">{d.scenario_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d.description || "Supuestos pendientes de publicar."}</p>
                <p className="mt-3 text-sm font-semibold">{rows.length ? `${rows.length} resultados` : "Pendiente de carga"}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-6">
          <VisualCard evidence={data.evidence} summary={evidenceSummary(data.evidence)}>
            {data.evidence.rows.length ? (
              <BarList rows={data.evidence.rows} />
            ) : (
              <EmptyState description="Los resultados de escenarios se cargarán desde el modelo externo revisado (tabla de resultados por escenario)." />
            )}
          </VisualCard>
        </div>
      </PageScroll>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { ObservedBadge } from "@/components/nexo/badges";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { methodologyQuery } from "@/lib/queries";
import type { ObservedOrModeled } from "@/lib/analytics/types";

export const Route = createFileRoute("/metodologia")({
  head: () => headFor("Metodología", "Diferencia entre cifras observadas y modeladas, diseño muestral de encuestas y explicación de MRP e ingreso imputado."),
  loader: ({ context }) => context.queryClient.ensureQueryData(methodologyQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Metodologia,
});

const TOPIC: Record<string, string> = {
  universe: "Universos",
  survey_design: "Diseño muestral",
  imputation: "Imputación",
  mrp: "MRP",
  scope: "Alcance",
  precision: "Precisión",
  interpretation: "Interpretación",
};

function Metodologia() {
  const { data } = useSuspenseQuery(methodologyQuery());
  return (
    <AppShell>
      <PageScroll title="Metodología" description="Qué es observado, qué es modelado y cómo leer la incertidumbre.">
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-lg border bg-card p-5">
            <ObservedBadge value="observed" />
            <h2 className="mt-2 text-lg font-bold">Observado</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Estimación directa de una encuesta con su diseño muestral (factor de expansión, estrato y UPM), o agregado oficial publicado tal cual.
            </p>
          </article>
          <article className="rounded-lg border bg-card p-5">
            <ObservedBadge value="modeled" />
            <h2 className="mt-2 text-lg font-bold">Estimación modelada</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Resultado de un modelo (p. ej. MRP municipal o ingreso/decil imputado). Siempre se etiqueta y se acompaña de su incertidumbre.
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-lg border bg-card p-5">
          <h2 className="text-lg font-bold">MRP en tres pasos</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["Modelo", "Regresión multinivel de la compra digital con ENDUTIH (edad, sexo, escolaridad, ámbito, entidad)."],
              ["Celdas", "Conteos demográficos municipales de la Encuesta Intercensal 2025."],
              ["Postestratificación", "Se ponderan las predicciones por celda para obtener tasas municipales con intervalos."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-md bg-muted p-3">
                <p className="text-xs font-bold text-accent-foreground">Paso {i + 1}</p>
                <p className="font-semibold">{t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <h2 className="mt-8 text-lg font-bold">Notas metodológicas</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.notes.map((n) => (
            <article key={n.note_code} className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">{TOPIC[n.topic] ?? n.topic}</p>
              <h3 className="mt-1 font-semibold">{n.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
              {n.source_name && <p className="mt-2 text-xs text-muted-foreground">Fuente: {n.source_name}</p>}
            </article>
          ))}
        </div>

        <h2 className="mt-8 text-lg font-bold">Métodos registrados</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.methods.map((m) => (
            <article key={m.method_code} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{m.method_label}</h3>
                <ObservedBadge value={m.observed_or_modeled as ObservedOrModeled} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            </article>
          ))}
        </div>
      </PageScroll>
    </AppShell>
  );
}

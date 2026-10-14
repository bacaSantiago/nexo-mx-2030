import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { GroupedBars } from "@/components/nexo/charts";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { PrecisionBadge, ObservedBadge } from "@/components/nexo/badges";
import { EmptyState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { segmentsQuery } from "@/lib/queries";
import { formatValue } from "@/lib/format";
import { compareSegments } from "@/lib/analytics.functions";
import { queryOptions } from "@tanstack/react-query";
import type { EvidenceRow } from "@/lib/analytics/types";

const areaPurchase = queryOptions({
  queryKey: ["segments-within", "purchase-area"],
  queryFn: () =>
    compareSegments({ data: { metric_code: "internet_use_type_pct", dimension: "area", year: 2025, within: { use_type: "Comprar productos o servicios" } } }),
  staleTime: 300_000,
});
const qs = [segmentsQuery("internet_users_pct", "sex", 2025), segmentsQuery("internet_users_pct", "area", 2025), segmentsQuery("internet_users_pct", "age_group", 2025), areaPurchase] as const;

export const Route = createFileRoute("/segmentos")({
  head: () => headFor("Segmentos", "Perfiles de brecha digital por sexo, ámbito y edad, con tabla comparativa de cifras oficiales."),
  loader: ({ context }) => Promise.all(qs.map((q) => context.queryClient.ensureQueryData(q as typeof qs[0]))),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Segmentos,
});

function Persona({ title, hint, row, extra }: { title: string; hint: string; row?: EvidenceRow; extra?: { label: string; row?: EvidenceRow } }) {
  return (
    <article className="flex flex-col rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-foreground">Perfil</p>
      <h3 className="mt-1 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt>Usa internet</dt><dd className="tabular font-bold">{row ? formatValue(row.estimate, row.unit) : "Pendiente de carga"}</dd></div>
        {extra && <div className="flex justify-between gap-3"><dt>{extra.label}</dt><dd className="tabular font-bold">{extra.row ? formatValue(extra.row.estimate, extra.row.unit) : "Pendiente de carga"}</dd></div>}
        <div className="flex justify-between gap-3"><dt>Compra digital del segmento</dt><dd className="text-muted-foreground">{extra ? "ver arriba" : "Pendiente de carga"}</dd></div>
      </dl>
      {row && <div className="mt-3 flex flex-wrap gap-1.5"><PrecisionBadge flag={row.precision_flag} /><ObservedBadge value={row.observed_or_modeled} /></div>}
    </article>
  );
}

function Segmentos() {
  const sex = useSuspenseQuery(qs[0]).data;
  const area = useSuspenseQuery(qs[1]).data;
  const age = useSuspenseQuery(qs[2]).data;
  const areaBuy = useSuspenseQuery(qs[3]).data;
  const rural = area.rows.find((r) => r.label === "Rural");
  const ruralBuy = areaBuy.rows.find((r) => r.label === "Rural");
  const old = age.rows.find((r) => r.label.startsWith("65"));
  const oldest = age.rows.find((r) => r.label.startsWith("75"));
  const women = sex.rows.find((r) => r.label === "Mujeres");
  const all = [...sex.rows.map((r) => ({ ...r, dim: "Sexo" })), ...area.rows.map((r) => ({ ...r, dim: "Ámbito" })), ...age.rows.map((r) => ({ ...r, dim: "Edad" }))];

  return (
    <AppShell>
      <PageScroll title="Segmentos" description="Perfiles descriptivos de quién queda fuera. Son cortes publicados, no grupos causales.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Persona title="Persona usuaria rural" hint="Vive en localidades rurales; menor conexión y oferta." row={rural} extra={{ label: "Compra por internet", row: ruralBuy }} />
          <Persona title="Persona mayor (65–74)" hint="Rezago generacional en uso digital." row={old} />
          <Persona title="Persona mayor (75+)" hint="El grupo con menor uso de internet." row={oldest} />
          <Persona title="Mujeres" hint="Brecha por sexo en uso de internet." row={women} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Compra digital por sexo, edad, escolaridad e ingreso imputado: pendiente de carga (requiere microdatos).</p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <VisualCard evidence={age} summary={evidenceSummary(age)}>
            {age.rows.length ? <GroupedBars data={age.rows.map((r) => ({ label: r.label.replace(" años", "").replace(" y más", "+"), v: r.estimate }))} series={[{ key: "v", label: "Personas usuarias (%)", color: "var(--chart-2)" }]} unit="percent" /> : <EmptyState />}
          </VisualCard>
          <VisualCard evidence={areaBuy} summary={evidenceSummary(areaBuy)} title="Compra por internet por ámbito">
            {areaBuy.rows.length ? <GroupedBars data={areaBuy.rows.map((r) => ({ label: r.label, v: r.estimate }))} series={[{ key: "v", label: "Compra (% de usuarias)", color: "var(--chart-3)" }]} unit="percent" /> : <EmptyState />}
          </VisualCard>
        </div>

        <section className="mt-8 rounded-lg border bg-card">
          <header className="border-b px-4 py-3">
            <h2 className="font-semibold">Tabla comparativa · Personas usuarias de internet, 2025</h2>
            <p className="text-xs text-muted-foreground">Porcentaje · {sex.universe?.split(",")[0]} · {sex.sources[0]?.source_name}</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Comparación de personas usuarias de internet por segmento</caption>
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="px-4 py-2">Dimensión</th><th className="px-4 py-2">Segmento</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2">Precisión</th><th className="px-4 py-2">Condición</th></tr></thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{r.dim}</td>
                    <td className="px-4 py-2">{r.label}</td>
                    <td className="tabular px-4 py-2 text-right font-semibold">{formatValue(r.estimate, r.unit)}</td>
                    <td className="px-4 py-2"><PrecisionBadge flag={r.precision_flag} /></td>
                    <td className="px-4 py-2"><ObservedBadge value={r.observed_or_modeled} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageScroll>
    </AppShell>
  );
}

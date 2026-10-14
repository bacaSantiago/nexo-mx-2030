import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { GroupedBars } from "@/components/nexo/charts";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { PrecisionBadge, ObservedBadge } from "@/components/nexo/badges";
import { EmptyState, LoadingState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { useGlobalFilters, withinExcept } from "@/components/nexo/filters-context";
import { segmentsQuery } from "@/lib/queries";
import { formatValue } from "@/lib/format";
import type { EvidenceRow } from "@/lib/analytics/types";

const buy = { use_type: "Comprar productos o servicios" };

function decileRank(label: string) {
  return Number(label.replace(/\D/g, "")) || 0;
}
const qs = [
  segmentsQuery("internet_users_pct", "sex", 2025),
  segmentsQuery("internet_users_pct", "area", 2025),
  segmentsQuery("internet_users_pct", "age_group", 2025),
  segmentsQuery("internet_use_type_pct", "area", 2025, buy),
] as const;

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
  const { filters } = useGlobalFilters();
  const year = filters.year ?? 2025;
  const geo = filters.geo_code ?? undefined;
  const sex = useQuery({ ...segmentsQuery("internet_users_pct", "sex", year, withinExcept(filters, "sex"), geo), placeholderData: keepPreviousData }).data;
  const area = useQuery({ ...segmentsQuery("internet_users_pct", "area", year, withinExcept(filters, "area"), geo), placeholderData: keepPreviousData }).data;
  const age = useQuery({ ...segmentsQuery("internet_users_pct", "age_group", year, withinExcept(filters, "age_group"), geo), placeholderData: keepPreviousData }).data;
  const areaBuy = useQuery({
    ...segmentsQuery("internet_use_type_pct", "area", year, { ...buy, ...withinExcept(filters, "area") }, geo),
    placeholderData: keepPreviousData,
  }).data;
  const schooling = useQuery({
    ...segmentsQuery("internet_users_pct", "schooling", year, withinExcept(filters, "schooling"), geo),
    placeholderData: keepPreviousData,
  }).data;
  const schoolBuy = useQuery({
    ...segmentsQuery("internet_use_type_pct", "schooling", year, { ...buy, ...withinExcept(filters, "schooling") }, geo),
    placeholderData: keepPreviousData,
  }).data;
  const income = useQuery({
    ...segmentsQuery("internet_users_pct", "income_decile", year, withinExcept(filters, "income_decile"), geo),
    placeholderData: keepPreviousData,
  }).data;
  const incomeBuy = useQuery({
    ...segmentsQuery("internet_use_type_pct", "income_decile", year, { ...buy, ...withinExcept(filters, "income_decile") }, geo),
    placeholderData: keepPreviousData,
  }).data;
  if (!sex || !area || !age || !areaBuy) return <AppShell><LoadingState /></AppShell>;
  const rural = area.rows.find((r) => r.label === "Rural");
  const ruralBuy = areaBuy.rows.find((r) => r.label === "Rural");
  const old = age.rows.find((r) => r.label.startsWith("65"));
  const oldest = age.rows.find((r) => r.label.startsWith("75"));
  const women = sex.rows.find((r) => r.label === "Mujeres");
  const schoolRow = filters.schooling ? schooling?.rows.find((r) => r.label === filters.schooling) : undefined;
  const schoolPurchase = filters.schooling ? schoolBuy?.rows.find((r) => r.label === filters.schooling) : undefined;
  const all = [
    ...sex.rows.map((r) => ({ ...r, dim: "Sexo" })),
    ...area.rows.map((r) => ({ ...r, dim: "Ámbito" })),
    ...age.rows.map((r) => ({ ...r, dim: "Edad" })),
    ...(schooling?.rows ?? []).map((r) => ({ ...r, dim: "Escolaridad" })),
    ...(income?.rows ?? []).map((r) => ({ ...r, dim: "Ingreso imputado" })),
  ];

  return (
    <AppShell>
      <PageScroll title="Segmentos" description="Perfiles descriptivos de quién queda fuera. Son cortes publicados, no grupos causales.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Persona title="Persona usuaria rural" hint="Vive en localidades rurales; menor conexión y oferta." row={rural} extra={{ label: "Compra por internet", row: ruralBuy }} />
          <Persona title="Persona mayor (65–74)" hint="Rezago generacional en uso digital." row={old} />
          <Persona title="Persona mayor (75+)" hint="El grupo con menor uso de internet." row={oldest} />
          <Persona title="Mujeres" hint="Brecha por sexo en uso de internet." row={women} />
          <Persona
            title={filters.schooling ?? "Escolaridad"}
            hint={schooling?.rows.length ? "Uso de internet según el nivel declarado en ENDUTIH." : "El cruce por escolaridad aparece cuando el microdato ya está cargado."}
            row={schoolRow}
            extra={schoolPurchase ? { label: "Compra por internet", row: schoolPurchase } : undefined}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Año {year}{geo ? ` · entidad ${geo}` : ""}. La compra por escolaridad sale del microdato. El decil de ingreso está imputado desde ENIGH 2024, no observado en ENDUTIH. Un cruce de tres filtros a la vez puede seguir vacío.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <VisualCard evidence={age} summary={evidenceSummary(age)}>
            {age.rows.length ? <GroupedBars data={age.rows.map((r) => ({ label: r.label.replace(" años", "").replace(" y más", "+"), v: r.estimate }))} series={[{ key: "v", label: "Personas usuarias (%)", color: "var(--chart-2)" }]} unit="percent" /> : <EmptyState />}
          </VisualCard>
          <VisualCard evidence={areaBuy} summary={evidenceSummary(areaBuy)} title="Compra por internet por ámbito">
            {areaBuy.rows.length ? <GroupedBars data={areaBuy.rows.map((r) => ({ label: r.label, v: r.estimate }))} series={[{ key: "v", label: "Compra (% de usuarias)", color: "var(--chart-3)" }]} unit="percent" /> : <EmptyState />}
          </VisualCard>
          {schooling && (
            <VisualCard evidence={schooling} summary={evidenceSummary(schooling)} title="Personas usuarias por escolaridad">
              {schooling.rows.length ? <GroupedBars data={schooling.rows.map((r) => ({ label: r.label, v: r.estimate }))} series={[{ key: "v", label: "Personas usuarias (%)", color: "var(--chart-1)" }]} unit="percent" /> : <EmptyState description="Aún no hay cruces de escolaridad en la base. Se cargan desde el microdato ENDUTIH, no desde la presentación." />}
            </VisualCard>
          )}
          {schoolBuy && (
            <VisualCard evidence={schoolBuy} summary={evidenceSummary(schoolBuy)} title="Compra por internet según escolaridad">
              {schoolBuy.rows.length ? <GroupedBars data={schoolBuy.rows.map((r) => ({ label: r.label, v: r.estimate }))} series={[{ key: "v", label: "Compra (% de usuarias)", color: "var(--chart-4)" }]} unit="percent" /> : <EmptyState description="Este cruce no está cargado para los filtros activos." />}
            </VisualCard>
          )}
          {income && (
            <VisualCard evidence={income} summary={evidenceSummary(income)} title="Personas usuarias por decil imputado">
              {income.rows.length ? <GroupedBars data={[...income.rows].sort((a, b) => decileRank(a.label) - decileRank(b.label)).map((r) => ({ label: r.label.replace("Decil ", "D"), v: r.estimate }))} series={[{ key: "v", label: "Personas usuarias (%)", color: "var(--chart-5)" }]} unit="percent" /> : <EmptyState description="El decil imputado no está cargado para este filtro." />}
            </VisualCard>
          )}
          {incomeBuy && (
            <VisualCard evidence={incomeBuy} summary={evidenceSummary(incomeBuy)} title="Compra por internet según decil imputado">
              {incomeBuy.rows.length ? <GroupedBars data={[...incomeBuy.rows].sort((a, b) => decileRank(a.label) - decileRank(b.label)).map((r) => ({ label: r.label.replace("Decil ", "D"), v: r.estimate }))} series={[{ key: "v", label: "Compra (% de usuarias)", color: "var(--chart-3)" }]} unit="percent" /> : <EmptyState description="La compra por decil imputado no está cargada para este filtro." />}
            </VisualCard>
          )}
        </div>

        <section className="mt-8 rounded-lg border bg-card">
          <header className="border-b px-4 py-3">
            <h2 className="font-semibold">Tabla comparativa · Personas usuarias de internet, {year}</h2>
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

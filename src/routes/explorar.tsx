import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { BarList, TrendChart } from "@/components/nexo/charts";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { MetricCard } from "@/components/nexo/cards";
import { EmptyState, LoadingState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { segmentFromFilters, useGlobalFilters, withinExcept } from "@/components/nexo/filters-context";
import { barriersQuery, categoriesQuery, metricQuery, segmentsQuery } from "@/lib/queries";
import type { EvidencePayload } from "@/lib/analytics/types";

const qs = [
  metricQuery("internet_users_pct"),
  metricQuery("households_with_internet_pct"),
  segmentsQuery("internet_use_type_pct", "use_type", 2025),
  segmentsQuery("internet_users_pct", "area"),
  categoriesQuery(2025),
  barriersQuery(2025),
  metricQuery("internet_users_millions"),
  metricQuery("nonbuyers_millions"),
  metricQuery("unemployment_rate_pct", { year: 2026, total_only: true }),
  metricQuery("ce_internet_sales_share_pct", { year: 2023, total_only: true }),
  metricQuery("profeco_complaints", { year: 2025, total_only: true }),
  metricQuery("enif_account_product_pct", { year: 2024, total_only: true }),
  metricQuery("enif_smartphone_pct", { year: 2024, total_only: true }),
  metricQuery("altan_covered_population_pct", { year: 2025, total_only: true }),
  metricQuery("denue_retail_establishments", { year: 2026, total_only: true }),
] as const;

export const Route = createFileRoute("/explorar")({
  head: () => headFor("Explorar", "Embudo de adopción digital, tendencia de acceso, categorías compradas y barreras de no compra en México."),
  loader: ({ context }) => Promise.all(qs.map((q) => context.queryClient.ensureQueryData(q as typeof qs[0]))),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Explorar,
});

function latest(e: EvidencePayload) {
  return e.rows.length ? e.rows.reduce((a, b) => (b.year > a.year ? b : a)) : null;
}

function Explorar() {
  const { filters } = useGlobalFilters();
  const segment = segmentFromFilters(filters);
  const year = filters.year ?? undefined;
  const geo = filters.geo_code ?? undefined;
  const scope = { ...(year ? { year } : {}), ...(geo ? { geo_code: geo } : {}), ...(segment ? { segment } : {}) };
  const slice = { ...(geo ? { geo_code: geo } : {}), ...(segment ? { segment } : {}) };
  const users = useQuery({ ...metricQuery("internet_users_pct", scope), placeholderData: keepPreviousData }).data;
  const hh = useQuery({ ...metricQuery("households_with_internet_pct", scope), placeholderData: keepPreviousData }).data;
  const uses = useQuery({
    ...segmentsQuery("internet_use_type_pct", "use_type", year ?? 2025, withinExcept(filters, "use_type"), geo),
    placeholderData: keepPreviousData,
  }).data;
  const area = useQuery({
    ...segmentsQuery("internet_users_pct", "area", year, withinExcept(filters, "area"), geo),
    placeholderData: keepPreviousData,
  }).data;
  const cats = useQuery({ ...categoriesQuery(year ?? 2025, slice), placeholderData: keepPreviousData }).data;
  const bars = useQuery({ ...barriersQuery(year ?? 2025, slice), placeholderData: keepPreviousData }).data;
  const usersM = useQuery({ ...metricQuery("internet_users_millions", scope), placeholderData: keepPreviousData }).data;
  const nonM = useQuery({ ...metricQuery("nonbuyers_millions", scope), placeholderData: keepPreviousData }).data;
  const unemployment = useQuery({ ...metricQuery("unemployment_rate_pct", { year: 2026, total_only: true }), placeholderData: keepPreviousData }).data;
  const internetSales = useQuery({ ...metricQuery("ce_internet_sales_share_pct", { year: 2023, total_only: true }), placeholderData: keepPreviousData }).data;
  const complaints = useQuery({ ...metricQuery("profeco_complaints", { year: 2025, total_only: true }), placeholderData: keepPreviousData }).data;
  const account = useQuery({ ...metricQuery("enif_account_product_pct", { year: 2024, total_only: true }), placeholderData: keepPreviousData }).data;
  const smartphone = useQuery({ ...metricQuery("enif_smartphone_pct", { year: 2024, total_only: true }), placeholderData: keepPreviousData }).data;
  const coverage = useQuery({ ...metricQuery("altan_covered_population_pct", { year: 2025, total_only: true }), placeholderData: keepPreviousData }).data;
  const retail = useQuery({ ...metricQuery("denue_retail_establishments", { year: 2026, total_only: true }), placeholderData: keepPreviousData }).data;
  if (!users || !hh || !uses || !area || !cats || !bars || !usersM || !nonM || !unemployment || !internetSales || !complaints || !account || !smartphone || !coverage || !retail) return <AppShell><LoadingState /></AppShell>;
  const purchase = uses.rows.find((r) => r.label.startsWith("Comprar")) ?? null;

  // Trend: national users + households, joined by year without filling gaps
  const years = [...new Set([...users.years, ...hh.years])].sort();
  const trend = years.map((y) => ({
    year: String(y),
    users: users.rows.find((r) => r.year === y)?.estimate ?? null,
    hh: hh.rows.find((r) => r.year === y)?.estimate ?? null,
  }));
  const areaRows = filters.area ? area.rows.filter((r) => r.label === filters.area) : area.rows;
  const areaYears = [...new Set(areaRows.map((r) => r.year))].sort((a, b) => a - b);
  const areaTrend = areaYears.map((y) => ({
    year: String(y),
    urb: areaRows.find((r) => r.year === y && r.label === "Urbano")?.estimate ?? null,
    rur: areaRows.find((r) => r.year === y && r.label === "Rural")?.estimate ?? null,
  }));
  const scopeNote = [
    year ? `Año ${year}` : null,
    geo ? `Entidad ${geo}` : null,
    segment ? Object.entries(segment).map(([k, v]) => `${k}: ${v}`).join(" · ") : null,
  ].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <PageScroll title="Explorar" description="Panorama de adopción: del acceso a internet a la compra digital. Cada paso tiene su propio universo.">
        {scopeNote && <p className="mb-3 text-xs text-muted-foreground">Filtro activo: {scopeNote}. Si el cruce no está publicado, la tarjeta queda en pendiente de carga.</p>}
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Embudo de adopción</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Embudo de adopción digital">
          <li><MetricCard label="1 · Hogares con internet" row={latest(hh)} universe={hh.universe} source="ENDUTIH" /></li>
          <li><MetricCard label="2 · Personas usuarias" row={latest(users)} universe={users.universe} source="ENDUTIH" /></li>
          <li><MetricCard label="3 · Usuarias que compran" row={purchase} universe="Personas usuarias de internet" source="ENDUTIH" emphasis /></li>
          <li><MetricCard label="Usuarias que no compran" row={latest(nonM)} universe={nonM.universe} source="ENDUTIH" /></li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Los pasos usan universos distintos (hogares, población de 6 años y más, personas usuarias); no se encadenan aritméticamente.
          {latest(usersM) && ` Personas usuarias: ${latest(usersM)!.estimate} millones.`}
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <VisualCard
            evidence={users}
            title="Tendencia de acceso a internet"
            summary={`${evidenceSummary(users)} Hogares: ${hh.rows.map((r) => `${r.year} ${r.estimate}%`).join(", ")}.`}
          >
            {trend.length ? (
              <TrendChart
                data={trend}
                unit="percent"
                series={[
                  { key: "users", label: "Personas usuarias (6+)", color: "var(--chart-1)" },
                  { key: "hh", label: "Hogares con internet", color: "var(--chart-3)" },
                ]}
              />
            ) : (
              <EmptyState />
            )}
          </VisualCard>
          <VisualCard evidence={area} title="Personas usuarias por ámbito" summary={evidenceSummary(area)}>
            {areaTrend.length ? (
              <TrendChart
                data={areaTrend}
                unit="percent"
                series={[
                  { key: "urb", label: "Urbano", color: "var(--chart-2)" },
                  { key: "rur", label: "Rural", color: "var(--chart-3)" },
                ]}
              />
            ) : (
              <EmptyState />
            )}
          </VisualCard>
          <VisualCard evidence={cats} summary={evidenceSummary(cats)}>
            {cats.rows.length ? <BarList rows={cats.rows} /> : <EmptyState />}
          </VisualCard>
          <VisualCard evidence={bars} summary={evidenceSummary(bars)}>
            {bars.rows.length ? <BarList rows={bars.rows} accent="coral" /> : <EmptyState />}
          </VisualCard>
        </div>

        <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-muted-foreground">Otras fuentes nacionales</h2>
        <p className="mb-3 text-xs text-muted-foreground">Estas cifras son nacionales y no siguen el filtro de entidad ni de segmento.</p>
        <ol className="grid gap-3 sm:grid-cols-3" aria-label="Desocupación, ventas por internet y quejas">
          <li><MetricCard label="Desocupación, ENOE 2026 2T" row={latest(unemployment)} universe={unemployment.universe} source="ENOE" /></li>
          <li><MetricCard label="Ventas por internet sobre ingresos, 2023" row={latest(internetSales)} universe={internetSales.universe} source="Censos Económicos 2024" /></li>
          <li><MetricCard label="Quejas PROFECO, 2025" row={latest(complaints)} universe={complaints.universe} source="PROFECO" /></li>
        </ol>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Inclusión, cobertura y establecimientos">
          <li><MetricCard label="Producto de captación, ENIF 2024" row={latest(account)} universe={account.universe} source="ENIF" /></li>
          <li><MetricCard label="Celular inteligente, ENIF 2024" row={latest(smartphone)} universe={smartphone.universe} source="ENIF" /></li>
          <li><MetricCard label="Población en localidades Altan" row={latest(coverage)} universe={coverage.universe} source="IFT" /></li>
          <li><MetricCard label="Comercio al por menor, DENUE" row={latest(retail)} universe={retail.universe} source="DENUE" /></li>
        </ol>
      </PageScroll>
    </AppShell>
  );
}

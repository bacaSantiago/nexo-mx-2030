import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { BarList, TrendChart } from "@/components/nexo/charts";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { MetricCard } from "@/components/nexo/cards";
import { EmptyState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
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
  const users = useSuspenseQuery(qs[0]).data;
  const hh = useSuspenseQuery(qs[1]).data;
  const uses = useSuspenseQuery(qs[2]).data;
  const area = useSuspenseQuery(qs[3]).data;
  const cats = useSuspenseQuery(qs[4]).data;
  const bars = useSuspenseQuery(qs[5]).data;
  const usersM = useSuspenseQuery(qs[6]).data;
  const nonM = useSuspenseQuery(qs[7]).data;
  const purchase = uses.rows.find((r) => r.label.startsWith("Comprar")) ?? null;

  // Trend: national users + households, joined by year without filling gaps
  const years = [...new Set([...users.years, ...hh.years])].sort();
  const trend = years.map((y) => ({
    year: String(y),
    users: users.rows.find((r) => r.year === y)?.estimate ?? null,
    hh: hh.rows.find((r) => r.year === y)?.estimate ?? null,
  }));
  const areaYears = area.years;
  const areaTrend = areaYears.map((y) => ({
    year: String(y),
    urb: area.rows.find((r) => r.year === y && r.label === "Urbano")?.estimate ?? null,
    rur: area.rows.find((r) => r.year === y && r.label === "Rural")?.estimate ?? null,
  }));

  return (
    <AppShell>
      <PageScroll title="Explorar" description="Panorama de adopción: del acceso a internet a la compra digital. Cada paso tiene su propio universo.">
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
      </PageScroll>
    </AppShell>
  );
}

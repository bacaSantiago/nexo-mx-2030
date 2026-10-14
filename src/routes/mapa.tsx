import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { LoadingState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { useGlobalFilters } from "@/components/nexo/filters-context";
import { opportunityQuery } from "@/lib/queries";
import type { PrecisionFlag } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

const ChoroplethMap = lazy(() => import("@/components/nexo/ChoroplethMap").then((m) => ({ default: m.ChoroplethMap })));
const BREAKS = [70, 75, 80, 85, 90];

export const Route = createFileRoute("/mapa")({
  head: () => headFor("Mapa de oportunidad", "Mapa por entidad del uso de internet y la conexión de hogares, con cuadrantes de oportunidad y estado de precisión."),
  loader: ({ context }) => context.queryClient.ensureQueryData(opportunityQuery(2025)),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: MapaPage,
});

const QUAD: Record<string, { label: string; desc: string }> = {
  alto_alto: { label: "Consolidación", desc: "Uso y conexión del hogar sobre el promedio nacional" },
  alto_bajo: { label: "Uso sin hogar conectado", desc: "Uso individual alto, conexión del hogar baja" },
  bajo_alto: { label: "Hogar conectado, uso rezagado", desc: "Conexión del hogar alta, uso individual bajo" },
  bajo_bajo: { label: "Rezago doble", desc: "Ambos indicadores bajo el promedio nacional" },
};

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn("rounded px-2.5 py-1 text-xs font-medium", value === o.v ? "bg-card shadow-sm" : "text-muted-foreground")}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function MapaPage() {
  const { filters } = useGlobalFilters();
  const year = filters.year ?? 2025;
  const { data } = useQuery({ ...opportunityQuery(year), placeholderData: keepPreviousData });
  const [metric, setMetric] = useState<"users_pct" | "households_pct">("users_pct");
  const [mode, setMode] = useState<"value" | "precision">("value");
  const precision = useMemo(() => {
    const out: Record<string, PrecisionFlag> = {};
    for (const p of data?.points ?? []) {
      const flag = metric === "users_pct" ? p.users_precision : p.households_precision;
      if (flag) out[p.geo_code] = flag;
    }
    return out;
  }, [data, metric]);
  if (!data) return <AppShell><LoadingState /></AppShell>;
  const focused = filters.geo_code ? data.points.filter((p) => p.geo_code === filters.geo_code) : data.points;
  const crossFilter = filters.sex || filters.age_group || filters.schooling || filters.area || filters.income_decile;
  const pts = data.points.filter((p) => p.users_pct != null && p.households_pct != null);
  const sorted = [...data.points].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1));
  const metricLabel = metric === "users_pct" ? "Personas usuarias de internet (6 años y más)" : "Hogares con internet";

  return (
    <AppShell>
      <PageScroll title="Mapa de oportunidad" description="Dónde hay acceso, dónde hay uso y dónde se acumulan rezagos. Cifras estatales observadas; la compra digital estatal requerirá estimación modelada.">
        <p className="mb-3 text-xs text-muted-foreground">
          Año {year}.
          {filters.geo_code ? ` Tabla acotada a la entidad ${focused[0]?.geo_name ?? filters.geo_code}.` : " Mapa y tabla de las 32 entidades."}
          {crossFilter ? " El mapa no tiene cruce estatal por sexo, edad, escolaridad, ámbito o ingreso; esos filtros no cambian estas cifras." : ""}
        </p>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <VisualCard
            evidence={data.evidence}
            title={metricLabel}
            summary={`${metricLabel}, ${year}. Mayor: ${sorted[0]?.geo_name} (${sorted[0]?.[metric]} %). Menor: ${sorted.at(-1)?.geo_name} (${sorted.at(-1)?.[metric]} %).`}
            actions={null}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <Toggle label="Indicador" value={metric} onChange={setMetric} options={[{ v: "users_pct", l: "Personas" }, { v: "households_pct", l: "Hogares" }]} />
              <Toggle label="Capa" value={mode} onChange={setMode} options={[{ v: "value", l: "Valor" }, { v: "precision", l: "Precisión" }]} />
            </div>
            <ClientOnly fallback={<LoadingState label="Cargando mapa…" rows={1} />}>
              <Suspense fallback={<LoadingState label="Cargando mapa…" rows={1} />}>
                <ChoroplethMap points={data.points} metric={metric} mode={mode} precision={precision} />
              </Suspense>
            </ClientOnly>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Leyenda">
              {mode === "value" ? (
                ["< 70", "70–75", "75–80", "80–85", "≥ 85"].map((l, i) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className={cn("size-3 rounded-sm border", ["bg-choro-1", "bg-choro-2", "bg-choro-3", "bg-choro-4", "bg-choro-5"][i])} aria-hidden />
                    {l} %
                  </span>
                ))
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-warning-soft" aria-hidden />Precisión pendiente (sin IC/CV)</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-choro-4" aria-hidden />Con precisión calculada</span>
                  <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border bg-muted" aria-hidden />Sin dato</span>
                </>
              )}
            </div>
            <p className="sr-only">Cortes de la escala: {BREAKS.join(", ")} por ciento.</p>
          </VisualCard>

          <VisualCard evidence={data.evidence} title="Cuadrantes de oportunidad" summary={evidenceSummary(data.evidence)}>
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer>
                <ScatterChart margin={{ top: 8, right: 12, bottom: 20, left: -8 }}>
                  <CartesianGrid stroke="var(--border)" />
                  <XAxis type="number" dataKey="households_pct" name="Hogares" unit="%" domain={[50, 95]} tick={{ fontSize: 11 }} label={{ value: "Hogares con internet (%)", position: "bottom", fontSize: 11, offset: 4 }} />
                  <YAxis type="number" dataKey="users_pct" name="Personas" unit="%" domain={[65, 100]} tick={{ fontSize: 11 }} width={48} />
                  <ZAxis range={[50, 50]} />
                  {data.national_households_pct != null && <ReferenceLine x={data.national_households_pct} stroke="var(--coral)" strokeDasharray="4 3" />}
                  {data.national_users_pct != null && <ReferenceLine y={data.national_users_pct} stroke="var(--coral)" strokeDasharray="4 3" />}
                  <Tooltip
                    cursor={false}
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as (typeof pts)[number] | undefined;
                      return p ? (
                        <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow">
                          <strong>{p.geo_name}</strong>
                          <br />Personas {p.users_pct} % · Hogares {p.households_pct} %
                        </div>
                      ) : null;
                    }}
                  />
                  <Scatter data={filters.geo_code ? pts.filter((p) => p.geo_code === filters.geo_code) : pts} fill="var(--chart-1)" isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground">Líneas punteadas: promedio nacional publicado.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(QUAD).map(([k, q]) => {
                const n = data.points.filter((p) => p.quadrant === k);
                return (
                  <li key={k} className="rounded-md border p-2.5">
                    <p className="text-sm font-semibold">{q.label} <span className="tabular text-muted-foreground">({n.length})</span></p>
                    <p className="text-xs text-muted-foreground">{q.desc}</p>
                    <p className="mt-1 text-xs">{n.map((p) => p.geo_name).join(", ") || "—"}</p>
                  </li>
                );
              })}
            </ul>
          </VisualCard>
        </div>

        <details className="mt-6 rounded-lg border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Tabla accesible por entidad</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Entidad</th><th className="py-2 pr-3 text-right">Personas (%)</th><th className="py-2 pr-3 text-right">Hogares (%)</th><th className="py-2">Cuadrante</th>
                </tr>
              </thead>
              <tbody>
                {focused.map((p) => (
                  <tr key={p.geo_code} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{p.geo_name}</td>
                    <td className="tabular py-1.5 pr-3 text-right">{p.users_pct ?? "Pendiente de carga"}</td>
                    <td className="tabular py-1.5 pr-3 text-right">{p.households_pct ?? "Pendiente de carga"}</td>
                    <td className="py-1.5">{p.quadrant ? QUAD[p.quadrant]?.label : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </PageScroll>
    </AppShell>
  );
}

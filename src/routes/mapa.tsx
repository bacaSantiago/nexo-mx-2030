import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { VisualCard } from "@/components/nexo/visual-card";
import { evidenceSummary } from "@/components/nexo/EvidenceCanvas";
import { LoadingState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { segmentFromFilters, useGlobalFilters } from "@/components/nexo/filters-context";
import { municipalInternetQuery, opportunityQuery } from "@/lib/queries";
import type { PrecisionFlag } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

const ChoroplethMap = lazy(() => import("@/components/nexo/ChoroplethMap").then((m) => ({ default: m.ChoroplethMap })));
const MunicipalPointMap = lazy(() => import("@/components/nexo/MunicipalPointMap").then((m) => ({ default: m.MunicipalPointMap })));
const DEFAULT_BREAKS = [70, 75, 80, 85, 90];

function scaleBreaks(values: number[]) {
  if (!values.length) return DEFAULT_BREAKS;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= 65 && max <= 100) return DEFAULT_BREAKS;
  const step = (max - min) / 5;
  if (step <= 0) return DEFAULT_BREAKS;
  return [1, 2, 3, 4].map((i) => Math.round((min + step * i) * 10) / 10);
}

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
  const segment = segmentFromFilters(filters);
  const { data } = useQuery({ ...opportunityQuery(year, segment), placeholderData: keepPreviousData });
  const [metric, setMetric] = useState<"users_pct" | "households_pct">("users_pct");
  const [mode, setMode] = useState<"value" | "precision">("value");
  const [munLayer, setMunLayer] = useState<"dwellings_with_internet_pct" | "eic_dwellings_with_internet_pct">("dwellings_with_internet_pct");
  const [munQuery, setMunQuery] = useState("");
  const [munFocus, setMunFocus] = useState<string | null>(null);
  const municipal = useQuery(municipalInternetQuery(munLayer)).data;
  const precision = useMemo(() => {
    const out: Record<string, PrecisionFlag> = {};
    for (const p of data?.points ?? []) {
      const flag = metric === "users_pct" ? p.users_precision : p.households_precision;
      if (flag) out[p.geo_code] = flag;
    }
    return out;
  }, [data, metric]);
  const munPoints = useMemo(() => {
    const q = munQuery.trim().toLowerCase();
    return (municipal?.points ?? []).filter((p) => {
      if (filters.geo_code && p.parent_geo_code !== filters.geo_code) return false;
      return !q || p.geo_name.toLowerCase().includes(q);
    });
  }, [municipal, filters.geo_code, munQuery]);
  if (!data) return <AppShell><LoadingState /></AppShell>;
  const focused = filters.geo_code ? data.points.filter((p) => p.geo_code === filters.geo_code) : data.points;
  const pts = data.points.filter((p) => p.users_pct != null && p.households_pct != null);
  const sorted = [...data.points].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1));
  const metricLabel = metric === "users_pct" ? "Personas usuarias de internet (6 años y más)" : "Hogares con internet";
  const breaks = scaleBreaks(data.points.map((p) => p[metric]).filter((v): v is number => v != null));
  const segmentLabel = segment ? Object.values(segment).join(" · ") : null;
  const munListed = munPoints.slice(0, filters.geo_code || munQuery.trim() ? 80 : 12);

  return (
    <AppShell>
      <PageScroll title="Mapa de oportunidad" description="Dónde hay acceso, dónde hay uso y dónde se acumulan rezagos. El color de personas sigue el segmento activo cuando ese cruce estatal ya está cargado.">
        <p className="mb-3 text-xs text-muted-foreground">
          Año {year}.
          {filters.geo_code ? ` Tabla acotada a la entidad ${focused[0]?.geo_name ?? filters.geo_code}.` : " Mapa y tabla de las 32 entidades."}
          {segmentLabel ? ` Personas: ${segmentLabel}. Hogares sigue el total de la entidad.` : ""}
          {segmentLabel && data.points.every((p) => p.users_pct == null) ? " Ese cruce estatal no tiene filas." : ""}
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
                <ChoroplethMap points={data.points} metric={metric} mode={mode} precision={precision} breaks={breaks} />
              </Suspense>
            </ClientOnly>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Leyenda">
              {mode === "value" ? (
                [`< ${breaks[0]}`, `${breaks[0]}–${breaks[1]}`, `${breaks[1]}–${breaks[2]}`, `${breaks[2]}–${breaks[3]}`, `≥ ${breaks[3]}`].map((l, i) => (
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
            <p className="sr-only">Cortes de la escala: {breaks.join(", ")} por ciento.</p>
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

        <section className="mt-8">
          {municipal?.evidence ? <VisualCard
            evidence={municipal.evidence}
            title={munLayer === "eic_dwellings_with_internet_pct" ? "Viviendas con internet por municipio, EIC 2025" : "Viviendas con internet por municipio, 2020"}
            summary={`${municipal.points.length} municipios. La búsqueda y la entidad filtran el mapa.`}
            actions={null}
          >
            <div className="mb-3">
              <Toggle
                label="Capa municipal"
                value={munLayer}
                onChange={setMunLayer}
                options={[{ v: "dwellings_with_internet_pct", l: "Censo 2020" }, { v: "eic_dwellings_with_internet_pct", l: "EIC 2025" }]}
              />
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              {munLayer === "eic_dwellings_with_internet_pct"
                ? "Porcentaje publicado de viviendas particulares habitadas con internet en la Encuesta Intercensal 2025. El punto sigue siendo el centroide del censo."
                : "Porcentaje de viviendas particulares habitadas con internet. Es el censo, no la encuesta de personas. El punto es un centroide, no el contorno del municipio."}
            </p>
            <input
              value={munQuery}
              onChange={(e) => setMunQuery(e.target.value)}
              placeholder="Buscar municipio"
              aria-label="Buscar municipio"
              className="mb-3 h-9 w-full max-w-sm rounded-md border bg-card px-3 text-sm"
            />
            {municipal?.points.length ? (
              <ClientOnly fallback={<LoadingState label="Cargando municipios…" rows={1} />}>
                <Suspense fallback={<LoadingState label="Cargando municipios…" rows={1} />}>
                  <MunicipalPointMap points={munPoints} focus={munFocus} />
                </Suspense>
              </ClientOnly>
            ) : (
              <p className="text-sm text-muted-foreground">Pendiente de carga: esta capa municipal todavía no tiene filas.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Menos de 20%</span><span>20–35</span><span>35–50</span><span>50–65</span><span>65% o más</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Municipios y porcentaje de viviendas con internet</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">Municipio</th><th className="py-2 pr-3">Clave</th><th className="py-2 text-right">Viviendas con internet (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {munListed.map((p) => (
                    <tr key={p.geo_code} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        <button type="button" className="text-left hover:underline" onClick={() => setMunFocus(p.geo_code)}>{p.geo_name}</button>
                      </td>
                      <td className="tabular py-1.5 pr-3 text-muted-foreground">{p.geo_code}</td>
                      <td className="tabular py-1.5 text-right">{p.estimate.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {munPoints.length > munListed.length && (
                <p className="mt-2 text-xs text-muted-foreground">Mostrando {munListed.length} de {munPoints.length}. Acota con la entidad o con la búsqueda.</p>
              )}
            </div>
          </VisualCard> : <p className="text-sm text-muted-foreground">Cargando la capa municipal.</p>}
        </section>
      </PageScroll>
    </AppShell>
  );
}

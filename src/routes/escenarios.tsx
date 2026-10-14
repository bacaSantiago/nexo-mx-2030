import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Printer, RotateCcw, TriangleAlert } from "lucide-react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { EmptyState } from "@/components/nexo/states";
import { ObservedBadge } from "@/components/nexo/badges";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { useGlobalFilters } from "@/components/nexo/filters-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { scenarioGridQuery } from "@/lib/queries";
import { defaultValues, groupBy, parseParams, resolvePoint, type ResolvedValue } from "@/lib/scenarios";
import { downloadBlob, filtersText, printBrief } from "@/lib/export";
import { formatValue } from "@/lib/format";

export const Route = createFileRoute("/escenarios")({
  head: () => headFor("Escenarios 2030", "Simulador transparente de escenarios 2030 de compra digital incluyente, leído de resultados precalculados y revisados."),
  loader: ({ context }) => context.queryClient.ensureQueryData(scenarioGridQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Escenarios,
});

const KPIS = [
  { code: "scenario_adoption_pct", label: "Adopción 2030" },
  { code: "scenario_additional_buyers", label: "Compradores adicionales vs. S0" },
  { code: "scenario_gap_reduction_pp", label: "Reducción de brecha" },
  { code: "scenario_economic_impact_mxn", label: "Impacto económico (rango)" },
];

const CAVEATS = [
  "Los resultados se leen de una malla de escenarios precalculada y revisada; la web no ajusta modelos.",
  "Los valores entre dos puntos aprobados de la malla se interpolan linealmente y se marcan como interpolados. No se extrapola fuera de los rangos aprobados.",
  "Los efectos de intervención son escenarios de sensibilidad mientras no exista evidencia causal mexicana.",
  "El impacto económico se expresa como rango bajo supuestos explícitos de la Matriz Insumo-Producto; no son ventas observadas.",
];

function fmt(v: number | null | undefined, unit: string) {
  if (v == null) return "Pendiente de carga";
  if (unit === "persons") return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(v)} personas`;
  if (unit === "percentage_points") return `${v.toFixed(1)} pp`;
  if (unit === "mxn_millions") return `$${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(v)} M`;
  return formatValue(v, unit);
}

function Escenarios() {
  const { data } = useSuspenseQuery(scenarioGridQuery());
  const { filters } = useGlobalFilters();
  const defs = data.definitions;
  const [code, setCode] = useState(defs[0]?.scenario_code ?? "s0");
  const def = defs.find((d) => d.scenario_code === code);
  const params = useMemo(() => parseParams(def?.assumptions), [def]);
  const [values, setValues] = useState<Record<string, number>>(() => defaultValues(params));
  const vals = useMemo(() => ({ ...defaultValues(params), ...values }), [params, values]);
  const segments = useMemo(() => [...new Set(data.rows.map((r) => r.segment_code))].sort(), [data.rows]);
  const [segment, setSegment] = useState("");
  const geo = filters.geo_code ?? "00";

  const scoped = (sc: string) => data.rows.filter((r) => r.scenario_code === sc && r.geo_code === geo && r.segment_code === segment);
  const resolveFor = (sc: string, metric: string, year: number, component = "") => {
    const scParams = parseParams(defs.find((d) => d.scenario_code === sc)?.assumptions);
    const rows = scoped(sc).filter((r) => r.metric_code === metric && r.reference_year === year && r.component_code === component);
    return resolvePoint(rows, sc === code ? vals : defaultValues(scParams), sc === code ? params : scParams);
  };

  const rows = scoped(code);
  const unitOf = (m: string) => data.metrics.find((x) => x.metric_code === m)?.default_unit ?? "percent";
  const years = [...new Set(rows.filter((r) => r.metric_code === "scenario_adoption_pct" && !r.component_code).map((r) => r.reference_year))].sort();
  const lastYear = years.at(-1) ?? 2030;
  const series = years.map((y) => {
    const v = resolveFor(code, "scenario_adoption_pct", y);
    return { year: String(y), estimate: v?.estimate ?? null, band: v && v.p10 != null && v.p90 != null ? [v.p10, v.p90] : null, interpolated: v?.interpolated };
  });
  const components = [...groupBy(rows.filter((r) => r.metric_code === "scenario_contribution_pp" && r.component_code && r.reference_year === lastYear), (r) => r.component_code).keys()];
  let acc = 0;
  const waterfall = components.map((c) => {
    const v = resolveFor(code, "scenario_contribution_pp", lastYear, c);
    const start = acc;
    acc += v?.estimate ?? 0;
    return { label: c, range: v ? [start, acc] : null, value: v?.estimate ?? null, interpolated: v?.interpolated };
  });
  const kpi = KPIS.map((k) => ({ ...k, unit: unitOf(k.code), value: resolveFor(code, k.code, lastYear) }));
  const anyInterp = kpi.some((k) => k.value?.interpolated) || series.some((s) => s.interpolated);
  const hasData = rows.length > 0;

  const reset = () => setValues(defaultValues(params));

  const exportSummary = () => {
    const lines = [
      `# NEXO MX 2030 — resumen de escenario`,
      `# escenario: ${def?.scenario_name ?? code}`,
      `# supuestos: ${params.map((p) => `${p.key}=${vals[p.key]}`).join("; ") || "sin supuestos parametrizados"}`,
      `# filtros: ${filtersText({ geo_code: geo, segmento: segment || "total" })}`,
      `# condicion: Escenario (no es pronóstico oficial)`,
      `# generado: ${new Date().toISOString()}`,
      "indicador,anio,estimacion,p10,p90,unidad,interpolado,filas_base,linaje",
      ...kpi.map((k) => csvLine(k.label, lastYear, k.value, k.unit, data.lineage)),
      ...KPIS.flatMap((k) => (k.code === "scenario_adoption_pct" ? years.map((y) => csvLine(`${k.label} ${y}`, y, resolveFor(code, k.code, y), unitOf(k.code), data.lineage)) : [])),
    ];
    downloadBlob(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `nexo-escenario-${code}.csv`);
  };

  return (
    <AppShell>
      <PageScroll title="Escenarios 2030" description="Rangos bajo supuestos explícitos, leídos de resultados precalculados y revisados. No son pronósticos oficiales.">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={code} onValueChange={(v) => { setCode(v); setValues({}); }}>
            <TabsList className="h-auto flex-wrap">
              {defs.map((d) => (
                <TabsTrigger key={d.scenario_code} value={d.scenario_code}>{d.scenario_name}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={segment || "__total"} onValueChange={(v) => setSegment(v === "__total" ? "" : v)}>
            <SelectTrigger className="w-48" aria-label="Segmento"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__total">Total (sin segmento)</SelectItem>
              {segments.filter(Boolean).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Entidad: {geo === "00" ? "Nacional" : geo} (filtro global)</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={!params.length}><RotateCcw aria-hidden /> Restablecer supuestos</Button>
            <Button variant="outline" size="sm" onClick={exportSummary} disabled={!hasData}><Download aria-hidden /> Resumen CSV</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                printBrief({
                  title: `Escenario ${def?.scenario_name ?? code}`,
                  evidence: [],
                  filters: { geo_code: geo, segmento: segment || "total" },
                  extra: [
                    { heading: "Indicadores 2030", lines: kpi.map((k) => `${k.label}: ${rangeText(k.value, k.unit)}${k.value?.interpolated ? " (interpolado)" : ""}`) },
                    { heading: "Supuestos", lines: params.length ? params.map((p) => `${p.label}: ${vals[p.key]}${p.unit ? ` ${p.unit}` : ""} (rango aprobado ${p.min}–${p.max})`) : ["Pendiente de carga"] },
                    { heading: "Advertencias", lines: CAVEATS },
                  ],
                })
              }
            >
              <Printer aria-hidden /> Informe
            </Button>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{def?.description}</p>

        {!hasData && (
          <div className="mt-4">
            <EmptyState
              title="Resultados pendientes de carga"
              description="Aún no hay una malla de escenarios revisada. Cuando se cargue el modelo de difusión con sus resultados por año, entidad y supuesto, este simulador los mostrará sin recalcular nada."
            />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4 rounded-lg border bg-card p-4" aria-label="Supuestos">
            <h2 className="font-semibold">Supuestos</h2>
            {params.length === 0 && <p className="text-sm text-muted-foreground">Rangos de supuestos pendientes de carga. Solo se mostrarán los rangos aprobados del modelo.</p>}
            {params.map((p) => (
              <div key={p.key}>
                <div className="flex justify-between text-sm">
                  <label htmlFor={`p-${p.key}`}>{p.label}</label>
                  <span className="tabular font-semibold">{vals[p.key]}{p.unit ? ` ${p.unit}` : ""}</span>
                </div>
                <Slider id={`p-${p.key}`} className="mt-2" min={p.min} max={p.max} step={p.step ?? (p.max - p.min) / 20} value={[vals[p.key] ?? p.default]} onValueChange={([v]) => setValues((s) => ({ ...s, [p.key]: v! }))} />
                <p className="mt-1 text-[11px] text-muted-foreground">Rango aprobado: {p.min}–{p.max}</p>
              </div>
            ))}
            {anyInterp && (
              <p className="flex gap-1.5 rounded-md bg-warning-soft p-2 text-xs text-warning-foreground"><TriangleAlert className="size-3.5 shrink-0" aria-hidden /> Algunos valores están interpolados entre puntos aprobados.</p>
            )}
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpi.map((k) => (
                <article key={k.code} className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{k.label} · {lastYear}</p>
                  <p className="tabular mt-1 text-xl font-bold">{fmt(k.value?.estimate, k.unit)}</p>
                  {k.value && k.value.p10 != null && <p className="tabular text-xs text-muted-foreground">p10–p90: {fmt(k.value.p10, k.unit)} – {fmt(k.value.p90, k.unit)}</p>}
                  <div className="mt-2 flex flex-wrap gap-1"><ObservedBadge value="scenario" />{k.value?.interpolated && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">Interpolado</span>}</div>
                </article>
              ))}
            </div>

            <section className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Adopción a 2030 con banda de incertidumbre (p10–p90)</h3>
              <p className="text-xs text-muted-foreground">Porcentaje · {def?.scenario_name}</p>
              {series.length ? (
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={44} />
                      <Tooltip />
                      <Area dataKey="band" stroke="none" fill="var(--chart-2)" fillOpacity={0.18} isAnimationActive={false} name="p10–p90" />
                      <Line dataKey="estimate" stroke="var(--chart-2)" strokeWidth={2.25} dot={{ r: 3 }} isAnimationActive={false} name="Estimación" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState description="Serie a 2030 pendiente de carga." />
              )}
            </section>

            <section className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Contribución por intervención ({lastYear})</h3>
              <p className="text-xs text-muted-foreground">Puntos porcentuales de adopción · cascada</p>
              {waterfall.length ? (
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfall} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} width={44} />
                      <Tooltip formatter={(_v, _n, p) => fmt((p.payload as { value: number | null }).value, "percentage_points")} />
                      <Bar dataKey="range" fill="var(--chart-3)" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState description="Contribuciones por intervención pendientes de carga." />
              )}
            </section>

            <section className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Comparación contra S0 Inercial ({lastYear})</h3>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicador</TableHead>
                    {defs.map((d) => <TableHead key={d.scenario_code}>{d.scenario_name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {KPIS.map((k) => {
                    const base = resolveFor("s0", k.code, lastYear);
                    return (
                      <TableRow key={k.code}>
                        <TableCell className="font-medium">{k.label}</TableCell>
                        {defs.map((d) => {
                          const v = resolveFor(d.scenario_code, k.code, lastYear);
                          const diff = v && base && d.scenario_code !== "s0" ? v.estimate - base.estimate : null;
                          return (
                            <TableCell key={d.scenario_code} className="tabular text-sm">
                              {fmt(v?.estimate, unitOf(k.code))}
                              {diff != null && <span className="block text-xs text-muted-foreground">Δ vs S0: {fmt(diff, unitOf(k.code))}</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </section>

            <section className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">Supuestos y advertencias</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {CAVEATS.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">Linaje: {data.lineage.length ? `${data.lineage.length} registros de origen` : "pendiente de carga"} · Versión de supuestos: {[...new Set(rows.map((r) => r.assumptions_version))].join(", ") || "—"}</p>
            </section>
          </div>
        </div>
      </PageScroll>
    </AppShell>
  );
}

function rangeText(v: ResolvedValue | null, unit: string) {
  if (!v) return "Pendiente de carga";
  return `${fmt(v.estimate, unit)}${v.p10 != null && v.p90 != null ? ` (p10–p90 ${fmt(v.p10, unit)} – ${fmt(v.p90, unit)})` : ""}`;
}

function csvLine(label: string, year: number, v: ResolvedValue | null, unit: string, lineage: { fact_id: string; transformation: string; loaded_version: string }[]) {
  const lin = v ? v.basis.map((id) => lineage.find((l) => l.fact_id === id)).filter(Boolean).map((l) => `${l!.transformation}@${l!.loaded_version}`).join(" | ") : "";
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [q(label), year, v?.estimate ?? "", v?.p10 ?? "", v?.p90 ?? "", unit, v?.interpolated ? "si" : "no", v?.basis.length ?? 0, q(lin)].join(",");
}


import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { EmptyState } from "@/components/nexo/states";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { interventionsQuery } from "@/lib/queries";
import type { InterventionItem } from "@/lib/analytics/types";

export const Route = createFileRoute("/acciones")({
  head: () => headFor("Acciones — Puentes NEXO", "Módulos Puentes NEXO con puntaje transparente: alcance, impacto modelado, equidad, factibilidad y costo relativo, con pesos ajustables y sensibilidad."),
  loader: ({ context }) => context.queryClient.ensureQueryData(interventionsQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Acciones,
});

type Key = "reach" | "modeled_uplift" | "equity" | "feasibility" | "relative_cost";
const CRITERIA: { key: Key; label: string; desc: string }[] = [
  { key: "reach", label: "Alcance", desc: "Personas del segmento afectadas por la barrera" },
  { key: "modeled_uplift", label: "Impacto modelado", desc: "Aumento modelado en compra digital (no causal)" },
  { key: "equity", label: "Equidad", desc: "Peso a grupos con mayor rezago" },
  { key: "feasibility", label: "Factibilidad", desc: "Capacidad de implementación" },
  { key: "relative_cost", label: "Costo relativo", desc: "Divide el puntaje: más costo, menos prioridad" },
];
const DEFAULT_W: Record<Key, number> = { reach: 1, modeled_uplift: 1, equity: 1, feasibility: 1, relative_cost: 1 };

/** Puntaje = Π(componente^peso) / costo^peso — exponentes como ponderaciones. */
function score(s: InterventionItem["scores"][number] | undefined, w: Record<Key, number>) {
  if (!s) return null;
  const parts = [s.reach, s.modeled_uplift, s.equity, s.feasibility, s.relative_cost];
  if (parts.some((p) => p == null || p <= 0)) return null;
  return (s.reach! ** w.reach * s.modeled_uplift! ** w.modeled_uplift * s.equity! ** w.equity * s.feasibility! ** w.feasibility) / s.relative_cost! ** w.relative_cost;
}

/** Rank range across a deterministic set of weight perturbations (each weight ×0.5 and ×1.5). */
function rankRanges(items: InterventionItem[], w: Record<Key, number>) {
  const sets: Record<Key, number>[] = [w];
  for (const c of CRITERIA) for (const f of [0.5, 1.5]) sets.push({ ...w, [c.key]: w[c.key] * f });
  const out = new Map<string, [number, number]>();
  for (const ws of sets) {
    const ranked = items.map((i) => ({ code: i.intervention_code, s: score(i.scores[0], ws) })).filter((x) => x.s != null).sort((a, b) => b.s! - a.s!);
    ranked.forEach((x, idx) => {
      const r = out.get(x.code);
      out.set(x.code, r ? [Math.min(r[0], idx + 1), Math.max(r[1], idx + 1)] : [idx + 1, idx + 1]);
    });
  }
  return out;
}

function Acciones() {
  const { data } = useSuspenseQuery(interventionsQuery());
  const [w, setW] = useState(DEFAULT_W);
  const ranges = useMemo(() => rankRanges(data, w), [data, w]);
  const scored = data.map((i) => ({ i, s: score(i.scores[0], w) })).sort((a, b) => (b.s ?? -1) - (a.s ?? -1));
  const anyScore = scored.some((x) => x.s != null);
  return (
    <AppShell>
      <PageScroll title="Acciones — Puentes NEXO" description="Módulos de intervención por barrera. Los actores son potenciales, no aliados confirmados. Los puntajes son modelados y no prueban causalidad.">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Ponderaciones de política</h2>
            <Button variant="outline" size="sm" onClick={() => setW(DEFAULT_W)}><RotateCcw aria-hidden /> Restablecer pesos</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Puntaje = alcance × impacto modelado × equidad × factibilidad ÷ costo relativo. Cada peso actúa como exponente del componente.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CRITERIA.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-sm"><label htmlFor={`w-${c.key}`} className="font-semibold">{c.label}</label><span className="tabular">{w[c.key].toFixed(1)}</span></div>
                <Slider id={`w-${c.key}`} className="mt-2" min={0} max={2} step={0.1} value={[w[c.key]]} onValueChange={([v]) => setW((s) => ({ ...s, [c.key]: v! }))} />
                <p className="mt-1 text-[11px] text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
          {!anyScore && <p className="mt-3 text-xs text-warning-foreground">Componentes de puntaje pendientes de carga: aún no hay un modelo de priorización revisado, por lo que no se muestra ranking.</p>}
        </section>

        {data.length === 0 && <div className="mt-6"><EmptyState description="El portafolio de módulos se cargará tras la revisión." /></div>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {scored.map(({ i, s }, idx) => {
            const kpis = Array.isArray(i.kpis) ? i.kpis : [];
            const kpiNames = kpis.map((k) => k.kpi).filter(Boolean);
            const rr = ranges.get(i.intervention_code);
            return (
              <article key={i.intervention_code} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold">{i.intervention_name}</h3>
                    <p className="text-xs text-muted-foreground">Barrera: {i.barrier_code}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold">{s != null ? `#${idx + 1} · ${s.toFixed(2)}` : "Puntaje pendiente"}</p>
                    {rr && <p className="text-muted-foreground">Rango de posición: {rr[0]}–{rr[1]}</p>}
                  </div>
                </div>
                <p className="mt-2 text-sm">{i.description}</p>
                <p className="mt-2 text-xs"><strong>Actores potenciales:</strong> {i.implementation_actors.join(", ") || "—"}</p>
                <div className="mt-3 space-y-1.5">
                  {CRITERIA.map((c) => {
                    const v = i.scores[0]?.[c.key] ?? null;
                    return (
                      <div key={c.key} className="grid grid-cols-[120px_1fr] items-center gap-2 text-xs">
                        <span>{c.label}</span>
                        {v == null ? <span className="text-muted-foreground">Pendiente de carga</span> : (
                          <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-teal" style={{ width: `${Math.max(0, Math.min(100, v * 100))}%` }} /></div><span className="tabular">{v.toFixed(2)}</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-md bg-muted p-3 text-xs">
                  <p className="font-semibold">KPI: {kpiNames.join(", ") || "—"}</p>
                  <ul className="mt-1 grid grid-cols-3 gap-2">
                    {([
                      [3, kpis[0]?.m3],
                      [6, kpis[0]?.m6],
                      [12, kpis[0]?.m12],
                    ] as const).map(([m, target]) => (
                      <li key={m}><span className="font-semibold">{m} meses:</span> {target ?? "meta pendiente"}</li>
                    ))}
                  </ul>
                  {i.evaluation_design && <p className="mt-2"><span className="font-semibold">Diseño de evaluación:</span> {i.evaluation_design}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </PageScroll>
    </AppShell>
  );
}

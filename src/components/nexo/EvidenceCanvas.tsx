import { FileSearch, X } from "lucide-react";
import type { EvidencePayload } from "@/lib/analytics/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { MetricCard, MethodCard, SourceCard } from "./cards";
import { BarList, TrendChart } from "./charts";
import { VisualCard, Warnings } from "./visual-card";
import { formatValue } from "@/lib/format";

export type CanvasState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; retry?: () => void }
  | { status: "ready"; evidence: EvidencePayload };

export function evidenceSummary(e: EvidencePayload) {
  if (!e.rows.length) return `${e.title}: pendiente de carga.`;
  const top = e.rows
    .slice(0, 6)
    .map((r) => `${r.label}: ${formatValue(r.estimate, r.unit)}`)
    .join("; ");
  return `${e.title} (${e.years.join(", ")}). ${top}. Universo: ${e.universe ?? "—"}.`;
}

export function EvidenceVisual({ evidence }: { evidence: EvidencePayload }) {
  const multiYear = evidence.years.length > 1 && new Set(evidence.rows.map((r) => JSON.stringify(r.segment))).size === 1;
  if (!evidence.rows.length) return <EmptyState description="No hay estimaciones revisadas para esta consulta." />;
  if (multiYear) {
    const data = evidence.rows.map((r) => ({ year: String(r.year), v: r.estimate }));
    return (
      <TrendChart
        data={data}
        unit={evidence.rows[0]?.unit ?? "percent"}
        series={[{ key: "v", label: evidence.metric?.metric_label ?? evidence.title, color: "var(--chart-2)" }]}
      />
    );
  }
  return <BarList rows={evidence.rows.slice(0, 16)} />;
}

export function EvidenceCanvas({ state, onClose }: { state: CanvasState; onClose?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide">Evidencia</h2>
          <p className="text-xs text-muted-foreground">Datos revisados, fuente y método</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar evidencia">
            <X />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "idle" && (
          <div className="p-4">
            <EmptyState
              icon={<FileSearch className="size-5" aria-hidden />}
              title="Sin evidencia seleccionada"
              description="Elige una pregunta sugerida para ver aquí la cifra oficial, su fuente, universo y método."
            />
          </div>
        )}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <div className="p-4">
            <ErrorState message={state.message} onRetry={state.retry} />
          </div>
        )}
        {state.status === "ready" && <ReadyCanvas evidence={state.evidence} />}
      </div>
    </div>
  );
}

function ReadyCanvas({ evidence }: { evidence: EvidencePayload }) {
  const source = evidence.sources[0]?.source_name;
  return (
    <Tabs defaultValue="visual" className="p-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="visual">Visual</TabsTrigger>
        <TabsTrigger value="metricas">Métricas</TabsTrigger>
        <TabsTrigger value="fuente">Fuente</TabsTrigger>
        <TabsTrigger value="metodo">Método</TabsTrigger>
      </TabsList>
      <TabsContent value="visual" className="mt-4">
        <VisualCard evidence={evidence} summary={evidenceSummary(evidence)}>
          <EvidenceVisual evidence={evidence} />
        </VisualCard>
      </TabsContent>
      <TabsContent value="metricas" className="mt-4 grid gap-3">
        {evidence.rows.length === 0 && <EmptyState />}
        {evidence.rows.slice(0, 8).map((r) => (
          <MetricCard key={r.id} label={r.label} row={r} universe={evidence.universe} source={source} />
        ))}
      </TabsContent>
      <TabsContent value="fuente" className="mt-4 grid gap-3">
        {evidence.sources.length === 0 && <EmptyState />}
        {evidence.sources.map((s) => (
          <SourceCard key={s.source_code} source={s} />
        ))}
      </TabsContent>
      <TabsContent value="metodo" className="mt-4 grid gap-3">
        {evidence.methods.map((m) => (
          <MethodCard key={m.method_code} method={m} universe={evidence.universe} />
        ))}
        {evidence.warnings.length > 0 && <Warnings items={evidence.warnings} />}
      </TabsContent>
    </Tabs>
  );
}

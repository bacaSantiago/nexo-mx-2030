import { Info, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import type { EvidencePayload } from "@/lib/analytics/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { unitLabel, OOM_LABEL, PRECISION_LABEL } from "@/lib/format";
import { MethodCard, SourceCard } from "./cards";
import { cn } from "@/lib/utils";

export function HowCalculated({ evidence }: { evidence: EvidencePayload }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-accent-foreground">
          <Info aria-hidden /> Cómo se calculó
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cómo se calculó</DialogTitle>
          <DialogDescription>{evidence.title}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-semibold">Universo</dt>
          <dd className="text-muted-foreground">{evidence.universe ?? "Pendiente de carga"}</dd>
          <dt className="font-semibold">Año(s)</dt>
          <dd className="text-muted-foreground">{evidence.years.join(", ") || "—"}</dd>
          <dt className="font-semibold">Condición</dt>
          <dd className="text-muted-foreground">{evidence.observed_or_modeled.map((o) => OOM_LABEL[o]).join(", ") || "—"}</dd>
          <dt className="font-semibold">Precisión</dt>
          <dd className="text-muted-foreground">
            {evidence.uncertainty.precision_flags.map((p) => PRECISION_LABEL[p]).join(", ") || "—"}
            {!evidence.uncertainty.has_intervals && " · sin intervalos publicados"}
          </dd>
          <dt className="font-semibold">Función</dt>
          <dd className="font-mono text-xs text-muted-foreground">{evidence.fn}</dd>
        </dl>
        <div className="space-y-3">
          {evidence.methods.map((m) => (
            <MethodCard key={m.method_code} method={m} />
          ))}
          {evidence.sources.map((s) => (
            <SourceCard key={s.source_code} source={s} />
          ))}
        </div>
        {evidence.warnings.length > 0 && <Warnings items={evidence.warnings} />}
      </DialogContent>
    </Dialog>
  );
}

export function Warnings({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-1.5 rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-warning-foreground", className)}>
      {items.map((w) => (
        <li key={w} className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

/** Wrapper every visual uses: title, unit, source, year, universe, method action and a text summary. */
export function VisualCard({
  evidence,
  title,
  summary,
  children,
  className,
  actions,
}: {
  evidence: EvidencePayload;
  title?: string;
  summary: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const unit = evidence.rows[0]?.unit ?? evidence.metric?.default_unit;
  const source = evidence.sources.map((s) => s.source_name).join(", ");
  return (
    <section
      aria-label={title ?? evidence.title}
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card shadow-[var(--shadow-soft)]", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{title ?? evidence.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unit ? unitLabel(unit) : "Unidad pendiente"} · {evidence.years.length ? evidence.years.join("–").replace(/–.*–/, "–") : "Año pendiente"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <HowCalculated evidence={evidence} />
        </div>
      </header>
      <div className="min-w-0 flex-1 p-4">{children}</div>
      <footer className="space-y-1 border-t px-4 py-3 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Fuente:</span> {source || "Pendiente de carga"}
        </p>
        <p>
          <span className="font-semibold text-foreground">Universo:</span> {evidence.universe ?? "Pendiente de carga"}
        </p>
        <details className="pt-1">
          <summary className="cursor-pointer font-medium text-foreground">Resumen en texto</summary>
          <p className="mt-1 leading-relaxed">{summary}</p>
        </details>
      </footer>
    </section>
  );
}

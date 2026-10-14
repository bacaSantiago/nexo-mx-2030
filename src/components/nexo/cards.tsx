import { ExternalLink } from "lucide-react";
import type { EvidenceMethod, EvidenceRow, EvidenceSource } from "@/lib/analytics/types";
import { formatValue, OOM_LABEL } from "@/lib/format";
import { ObservedBadge, PrecisionBadge } from "./badges";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  row,
  universe,
  source,
  emphasis,
  className,
}: {
  label: string;
  row: EvidenceRow | null | undefined;
  universe?: string | null;
  source?: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]",
        emphasis && "border-teal/40",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular font-bold leading-none text-foreground", row ? "text-3xl" : "text-base text-muted-foreground")}>
        {row ? formatValue(row.estimate, row.unit) : "Pendiente de carga"}
      </p>
      {row && (row.ci_low != null && row.ci_high != null) && (
        <p className="tabular text-xs text-muted-foreground">
          IC {formatValue(row.ci_low, row.unit)} – {formatValue(row.ci_high, row.unit)}
        </p>
      )}
      {row && (
        <div className="flex flex-wrap gap-1.5">
          <PrecisionBadge flag={row.precision_flag} cv={row.cv} />
          <ObservedBadge value={row.observed_or_modeled} />
        </div>
      )}
      <p className="mt-auto text-xs leading-snug text-muted-foreground">
        {row ? `${row.year} · ` : ""}
        {universe ?? ""}
        {source ? ` · ${source}` : ""}
      </p>
    </article>
  );
}

export function SourceCard({ source }: { source: EvidenceSource }) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <p className="font-semibold">{source.source_name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {source.year ?? "Año no especificado"}
        {source.pages.length > 0 && ` · pág. ${source.pages.join(", ")}`}
      </p>
      <a
        href={source.official_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-foreground underline-offset-4 hover:underline"
      >
        Documento oficial <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </article>
  );
}

export function MethodCard({ method, universe }: { method: EvidenceMethod; universe?: string | null }) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{method.method_label}</p>
        <ObservedBadge value={method.observed_or_modeled} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{method.description}</p>
      {universe && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Universo:</span> {universe}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Condición:</span> {OOM_LABEL[method.observed_or_modeled]}
      </p>
    </article>
  );
}

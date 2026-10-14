import { cn } from "@/lib/utils";
import type { ObservedOrModeled, PrecisionFlag } from "@/lib/analytics/types";
import { OOM_LABEL, PRECISION_LABEL } from "@/lib/format";

const precisionStyle: Record<PrecisionFlag, string> = {
  high: "bg-teal-soft text-accent-foreground border-teal/30",
  moderate: "bg-teal-soft text-accent-foreground border-teal/20",
  low: "bg-warning-soft text-warning-foreground border-warning/40",
  unreliable: "bg-coral-soft text-destructive border-coral/40",
  pending_microdata_recalculation: "bg-warning-soft text-warning-foreground border-warning/40",
};

export function PrecisionBadge({ flag, cv, className }: { flag: PrecisionFlag; cv?: number | null; className?: string }) {
  return (
    <span
      title={flag === "pending_microdata_recalculation" ? "Error estándar, IC y CV pendientes de recalcular con microdatos" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
        precisionStyle[flag],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {PRECISION_LABEL[flag]}
      {cv != null && <span className="tabular font-normal">· CV {cv.toFixed(1)}</span>}
    </span>
  );
}

export function ObservedBadge({ value, className }: { value: ObservedOrModeled; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4",
        value === "observed" ? "border-primary/20 bg-secondary text-secondary-foreground" : "border-coral/40 bg-coral-soft text-foreground",
        className,
      )}
    >
      {OOM_LABEL[value]}
    </span>
  );
}

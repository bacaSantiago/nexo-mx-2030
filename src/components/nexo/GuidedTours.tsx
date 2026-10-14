import { useNavigate } from "@tanstack/react-router";
import { TOURS, useGlobalFilters } from "./filters-context";
import { cn } from "@/lib/utils";

/** Three preset walks. They only set filters that the analytical pages already read. */
export function GuidedTours() {
  const { tour, applyTour } = useGlobalFilters();
  const navigate = useNavigate();
  const active = TOURS.find((item) => item.id === tour);
  return (
    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b bg-card/60 px-3 py-1.5 sm:px-4">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recorridos</span>
      {TOURS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            tour === item.id ? "border-teal bg-teal text-teal-foreground" : "bg-card hover:bg-muted",
          )}
          onClick={() => {
            applyTour(item.id);
            void navigate({ to: item.to });
          }}
        >
          {item.title}
        </button>
      ))}
      {active && <span className="shrink-0 text-xs text-muted-foreground">{active.detail}</span>}
    </div>
  );
}

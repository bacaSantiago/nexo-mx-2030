import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AppShell, PageScroll } from "./AppShell";
import { EmptyState, ErrorState, LoadingState } from "./states";

export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <AppShell>
      <PageScroll title="Algo falló">
        <ErrorState message={error instanceof Error ? error.message : undefined} onRetry={() => router.invalidate()} />
      </PageScroll>
    </AppShell>
  );
}

export function RoutePending() {
  return (
    <AppShell>
      <PageScroll title="Cargando…">
        <LoadingState rows={4} />
      </PageScroll>
    </AppShell>
  );
}

export function RouteNotFound() {
  return (
    <AppShell>
      <PageScroll title="Sin resultados">
        <EmptyState description="No encontramos esta vista." />
      </PageScroll>
    </AppShell>
  );
}

export function headFor(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — NEXO MX 2030` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — NEXO MX 2030` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}

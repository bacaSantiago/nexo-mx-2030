import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { EmptyState } from "@/components/nexo/states";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { sourcesQuery } from "@/lib/queries";
import { downloadBlob } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { SourceCatalogItem } from "@/lib/analytics/types";

export const Route = createFileRoute("/fuentes")({
  head: () => headFor("Fuentes", "Catálogo buscable de fuentes oficiales: institución, edición, universo, cobertura, tablas usadas, fecha de carga, versión y enlace oficial."),
  loader: ({ context }) => context.queryClient.ensureQueryData(sourcesQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Fuentes,
});

const STATUS: Record<string, { label: string; cls: string }> = {
  curated_included: { label: "Datos cargados", cls: "bg-teal-soft text-accent-foreground" },
  metadata_included: { label: "Metadatos cargados", cls: "bg-secondary text-secondary-foreground" },
  pending_download: { label: "Pendiente de carga", cls: "bg-warning-soft text-warning-foreground" },
  archived: { label: "Archivado", cls: "bg-muted text-muted-foreground" },
};

const PROGRAMS: { key: string; label: string; re: RegExp }[] = [
  { key: "endutih", label: "ENDUTIH", re: /^endutih/ },
  { key: "enigh", label: "ENIGH", re: /^enigh/ },
  { key: "eic", label: "EIC", re: /^eic/ },
  { key: "enoe", label: "ENOE", re: /^enoe/ },
  { key: "enif", label: "ENIF", re: /^enif/ },
  { key: "ce", label: "Censos Económicos", re: /^censos/ },
  { key: "vabcoel", label: "VABCOEL", re: /^vabcoel/ },
  { key: "mip", label: "MIP", re: /^mip/ },
  { key: "denue", label: "DENUE", re: /^denue/ },
  { key: "cnbv", label: "CNBV", re: /^cnbv/ },
  { key: "ift", label: "IFT", re: /^ift/ },
  { key: "marco", label: "Marco Geoestadístico", re: /^marco/ },
  { key: "profeco", label: "PROFECO (opcional)", re: /^profeco/ },
];
const programOf = (s: SourceCatalogItem) => PROGRAMS.find((p) => p.re.test(s.source_code))?.key ?? "otro";
const P = (v: string | null | undefined) => v || <span className="text-muted-foreground">Pendiente</span>;

function Fuentes() {
  const { data } = useSuspenseQuery(sourcesQuery());
  const [q, setQ] = useState("");
  const [program, setProgram] = useState("all");
  const [status, setStatus] = useState("all");
  const [inst, setInst] = useState("all");
  const institutions = [...new Set(data.map((d) => d.institution).filter(Boolean))] as string[];
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.filter(
      (d) =>
        (program === "all" || programOf(d) === program) &&
        (status === "all" || d.status === status) &&
        (inst === "all" || d.institution === inst) &&
        (!t || [d.source_name, d.title, d.purpose ?? "", d.universes.join(" "), d.modules_used.join(" ")].join(" ").toLowerCase().includes(t)),
    );
  }, [data, q, program, status, inst]);

  const exportCatalog = () => {
    const head = "programa,fuente,titulo,institucion,edicion,universo,cobertura,tablas,estado,ultima_carga,hash,enlace";
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = items.map((d) =>
      [programOf(d), d.source_name, d.title, d.institution, d.edition ?? d.year, d.universe_description ?? d.universes.join(" / "), d.geographic_coverage, d.modules_used.join(" | "), d.status, d.retrieved_at, d.sha256, d.official_url].map(esc).join(","),
    );
    downloadBlob(new Blob(["\uFEFF" + [`# NEXO MX 2030 — catálogo de fuentes · generado ${new Date().toISOString()}`, head, ...rows].join("\n")], { type: "text/csv;charset=utf-8" }), "nexo-fuentes.csv");
  };

  return (
    <AppShell>
      <PageScroll title="Fuentes" description="Fuentes oficiales usadas o previstas. NEXO es un observatorio cívico; no es un sitio oficial de gobierno.">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fuente, tabla o universo…" className="pl-9" aria-label="Buscar fuentes" />
          </div>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-44" aria-label="Programa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los programas</SelectItem>
              {PROGRAMS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={inst} onValueChange={setInst}>
            <SelectTrigger className="w-40" aria-label="Institución"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda institución</SelectItem>
              {institutions.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44" aria-label="Estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo estado</SelectItem>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCatalog}><Download aria-hidden /> CSV</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{items.length} de {data.length} documentos</p>
        {items.length === 0 && <div className="mt-4"><EmptyState description="Ninguna fuente coincide con la búsqueda." /></div>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((d) => {
            const st = STATUS[d.status] ?? STATUS.pending_download!;
            return (
              <article key={d.id} className="flex flex-col rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{PROGRAMS.find((p) => p.key === programOf(d))?.label ?? "Otra"}</p>
                    <h3 className="font-bold leading-tight">{d.source_name}</h3>
                    <p className="text-sm text-muted-foreground">{d.title}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", st.cls)}>{st.label}</span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="font-semibold">Institución</dt><dd>{P(d.institution)}</dd>
                  <dt className="font-semibold">Edición</dt><dd>{P(d.edition ?? (d.year ? String(d.year) : null))}</dd>
                  <dt className="font-semibold">Universo</dt><dd>{P(d.universe_description ?? (d.universes.join(" / ") || null))}</dd>
                  <dt className="font-semibold">Cobertura</dt><dd>{P(d.geographic_coverage)}</dd>
                  <dt className="font-semibold">Tablas/módulos</dt><dd>{P(d.modules_used.join(", ") || d.resource_type)}</dd>
                  <dt className="font-semibold">Última carga</dt><dd>{P(d.retrieved_at ? new Date(d.retrieved_at).toLocaleDateString("es-MX") : d.status === "curated_included" ? new Date(d.updated_at).toLocaleDateString("es-MX") : null)}</dd>
                  <dt className="font-semibold">Versión/hash</dt><dd className="truncate font-mono" title={d.sha256 ?? ""}>{P(d.sha256 ? d.sha256.slice(0, 16) : null)}</dd>
                  <dt className="font-semibold">Cifras</dt><dd>{d.estimate_count ? `${d.estimate_count} estimaciones cargadas` : "—"}</dd>
                </dl>
                {d.purpose && <p className="mt-2 text-xs text-muted-foreground">{d.purpose}</p>}
                <a href={d.official_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline">
                  Enlace oficial <ExternalLink className="size-3.5" aria-hidden />
                </a>
              </article>
            );
          })}
        </div>
      </PageScroll>
    </AppShell>
  );
}

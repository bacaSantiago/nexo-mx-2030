import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  EvidenceMethod,
  EvidencePayload,
  EvidenceRow,
  EvidenceSource,
  MetricMeta,
  ObservedOrModeled,
  PrecisionFlag,
} from "@/lib/analytics/types";

export function publicDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Configuración del servidor incompleta");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type Db = ReturnType<typeof publicDb>;

const FE_SELECT =
  "id, metric_code, reference_year, universe, geo_level, geo_code, segment_json, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, source_page, note, source_id, method_id";

export { FE_SELECT };

type FeRow = {
  id: string;
  metric_code: string;
  reference_year: number;
  universe: string;
  geo_level: string;
  geo_code: string;
  segment_json: unknown;
  estimate: number;
  unit: string;
  standard_error: number | null;
  ci_low: number | null;
  ci_high: number | null;
  confidence_level: number | null;
  cv: number | null;
  precision_flag: string;
  observed_or_modeled: string;
  source_page: string | null;
  note: string | null;
  source_id: string;
  method_id: string;
};

export async function getMetricMeta(db: Db, metric_code: string): Promise<MetricMeta | null> {
  const { data, error } = await db
    .from("dim_metric")
    .select("metric_code, metric_label, description, default_unit, universe, universe_type, status")
    .eq("metric_code", metric_code)
    .maybeSingle();
  if (error) throw new Error("No fue posible leer el catálogo de métricas");
  return data;
}

async function geoNames(db: Db): Promise<Map<string, string>> {
  const { data } = await db.from("dim_geography").select("geo_level, geo_code, geo_name");
  return new Map((data ?? []).map((g) => [`${g.geo_level}:${g.geo_code}`, g.geo_name]));
}

function segLabel(seg: Record<string, string>, geoName: string | null) {
  const vals = Object.values(seg);
  if (vals.length) return vals.join(" · ");
  return geoName ?? "Nacional";
}

export async function buildEvidence(
  db: Db,
  args: {
    fn: string;
    title: string;
    metric: MetricMeta | null;
    rows: FeRow[];
    warnings?: string[];
    labelFor?: (r: FeRow, seg: Record<string, string>) => string;
  },
): Promise<EvidencePayload> {
  const { rows } = args;
  const warnings = [...(args.warnings ?? [])];
  const names = await geoNames(db);
  const sourceIds = [...new Set(rows.map((r) => r.source_id))];
  const methodIds = [...new Set(rows.map((r) => r.method_id))];
  const [srcRes, mRes] = await Promise.all([
    sourceIds.length
      ? db.from("source_document").select("id, source_code, source_name, official_url, year").in("id", sourceIds)
      : Promise.resolve({ data: [] as { id: string; source_code: string; source_name: string; official_url: string; year: number | null }[] }),
    methodIds.length
      ? db.from("dim_method").select("id, method_code, method_label, description, observed_or_modeled").in("id", methodIds)
      : Promise.resolve({ data: [] as { id: string; method_code: string; method_label: string; description: string; observed_or_modeled: string }[] }),
  ]);

  const sources: EvidenceSource[] = (srcRes.data ?? []).map((s) => ({
    source_code: s.source_code,
    source_name: s.source_name,
    official_url: s.official_url,
    year: s.year,
    pages: [
      ...new Set(rows.filter((r) => r.source_id === s.id && r.source_page).map((r) => r.source_page as string)),
    ].sort((a, b) => Number(a) - Number(b)),
  }));
  const methods: EvidenceMethod[] = (mRes.data ?? []).map((m) => ({
    method_code: m.method_code,
    method_label: m.method_label,
    description: m.description,
    observed_or_modeled: m.observed_or_modeled as ObservedOrModeled,
  }));

  const out: EvidenceRow[] = rows.map((r) => {
    const seg = (r.segment_json ?? {}) as Record<string, string>;
    const gname = names.get(`${r.geo_level}:${r.geo_code}`) ?? null;
    return {
      id: r.id,
      label: args.labelFor ? args.labelFor(r, seg) : segLabel(seg, gname),
      estimate: Number(r.estimate),
      unit: r.unit,
      year: r.reference_year,
      geo_level: r.geo_level,
      geo_code: r.geo_code,
      geo_name: gname,
      segment: seg,
      standard_error: r.standard_error,
      ci_low: r.ci_low,
      ci_high: r.ci_high,
      confidence_level: r.confidence_level,
      cv: r.cv,
      precision_flag: r.precision_flag as PrecisionFlag,
      observed_or_modeled: r.observed_or_modeled as ObservedOrModeled,
      source_page: r.source_page,
      note: r.note,
    };
  });

  const flags = [...new Set(out.map((r) => r.precision_flag))];
  const oom = [...new Set(out.map((r) => r.observed_or_modeled))];
  const universes = [...new Set(rows.map((r) => r.universe))];
  if (flags.includes("pending_microdata_recalculation"))
    warnings.push("Precisión pendiente: error estándar, intervalos y CV se recalcularán con microdatos.");
  if (universes.length > 1) warnings.push("Las cifras provienen de universos distintos; no se comparan directamente.");
  if (!out.length) warnings.push("Pendiente de carga: no hay estimaciones revisadas para esta consulta.");
  if (out.some((r) => r.note && /m[uú]ltiple|Multiple/i.test(r.note)))
    warnings.push("Respuesta múltiple: las categorías no se suman.");

  return {
    fn: args.fn,
    title: args.title,
    metric: args.metric,
    rows: out,
    universe: universes.length === 1 ? universes[0] : universes.length ? universes.join(" / ") : args.metric?.universe ?? null,
    years: [...new Set(out.map((r) => r.year))].sort(),
    sources,
    methods,
    observed_or_modeled: oom,
    uncertainty: {
      precision_flags: flags,
      has_intervals: out.some((r) => r.ci_low != null && r.ci_high != null),
    },
    warnings: [...new Set(warnings)],
    generated_at: new Date().toISOString(),
  };
}

export async function queryFacts(
  db: Db,
  q: {
    metric_code: string;
    year?: number;
    geo_level?: string;
    geo_code?: string;
    segment?: Record<string, string>;
    segmentKeyEmpty?: boolean;
    hasDimension?: string;
  },
): Promise<FeRow[]> {
  let req = db.from("fact_estimate").select(FE_SELECT).eq("metric_code", q.metric_code);
  if (q.year) req = req.eq("reference_year", q.year);
  if (q.geo_level) req = req.eq("geo_level", q.geo_level);
  if (q.geo_code) req = req.eq("geo_code", q.geo_code);
  if (q.segment && Object.keys(q.segment).length) req = req.contains("segment_json", q.segment);
  if (q.segmentKeyEmpty) req = req.eq("segment_key", "");
  const { data, error } = await req.order("reference_year").limit(1000);
  if (error) throw new Error("No fue posible leer las estimaciones");
  let rows = (data ?? []) as FeRow[];
  if (q.hasDimension) {
    const dim = q.hasDimension;
    rows = rows.filter((r) => {
      const s = (r.segment_json ?? {}) as Record<string, string>;
      return dim in s;
    });
  }
  return rows;
}

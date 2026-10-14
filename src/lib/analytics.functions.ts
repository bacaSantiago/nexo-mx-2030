import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { codeSchema, geoCodeSchema, yearSchema } from "@/lib/analytics/types";
import type {
  FilterOptions,
  FinancialAccessPayload,
  InterventionItem,
  MethodologyNote,
  MunicipalPayload,
  OpportunityPayload,
  OpportunityPoint,
  PrecisionFlag,
  ScenarioPayload,
  ScenarioGridPayload,
  SourceCatalogItem,
} from "@/lib/analytics/types";
import { buildEvidence, getMetricMeta, publicDb, queryFacts, FE_SELECT } from "@/lib/analytics.server";

const segmentSchema = z.record(z.string().max(40).regex(/^[a-z_]+$/), z.string().max(120)).optional();

function exactSegmentKey(segment: Record<string, string> | undefined) {
  if (!segment || !Object.keys(segment).length) return "";
  return Object.keys(segment)
    .sort()
    .map((key) => `${key}=${segment[key]}`)
    .join("|");
}
const dimensionSchema = z.enum(["sex", "area", "age_group", "use_type", "schooling", "income_decile"]);

// ---------- get_metric ----------
export const getMetric = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      metric_code: codeSchema,
      year: yearSchema.optional(),
      geo_level: z.enum(["national", "state"]).optional(),
      geo_code: geoCodeSchema.optional(),
      segment: segmentSchema,
      total_only: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = publicDb();
    const metric = await getMetricMeta(db, data.metric_code);
    if (!metric) return buildEvidence(db, { fn: "get_metric", title: "Métrica no disponible", metric: null, rows: [] });
    const rows = await queryFacts(db, {
      metric_code: data.metric_code,
      year: data.year,
      geo_level: data.geo_level ?? "national",
      geo_code: data.geo_code ?? (data.geo_level === "state" ? undefined : "00"),
      segment: data.segment,
      segmentKeyEmpty: data.total_only ?? !data.segment,
    });
    // Same national total can be published on several pages; keep the first per year.
    const seen = new Set<string>();
    const dedup = rows.filter((r) => {
      const k = `${r.reference_year}|${r.geo_code}|${JSON.stringify(r.segment_json)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return buildEvidence(db, {
      fn: "get_metric",
      title: metric.metric_label,
      metric,
      rows: dedup,
      labelFor: (r) => String(r.reference_year),
    });
  });

// ---------- compare_segments ----------
export const compareSegments = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      metric_code: codeSchema,
      dimension: dimensionSchema,
      year: yearSchema.optional(),
      within: segmentSchema,
      geo_code: geoCodeSchema.optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = publicDb();
    const metric = await getMetricMeta(db, data.metric_code);
    const rows = await queryFacts(db, {
      metric_code: data.metric_code,
      year: data.year,
      geo_level: data.geo_code ? "state" : "national",
      geo_code: data.geo_code ?? "00",
      segment: data.within,
      hasDimension: data.dimension,
    });
    const extra = Object.keys(data.within ?? {}).length;
    const filtered = rows.filter((r) => {
      const s = (r.segment_json ?? {}) as Record<string, string>;
      return Object.keys(s).length === 1 + extra && s[data.dimension] !== "Total";
    });
    const dimLabel: Record<string, string> = { sex: "sexo", area: "ámbito", age_group: "grupo de edad", use_type: "tipo de uso", schooling: "escolaridad", income_decile: "decil de ingreso imputado" };
    return buildEvidence(db, {
      fn: "compare_segments",
      title: `${metric?.metric_label ?? "Métrica"} por ${dimLabel[data.dimension]}`,
      metric,
      rows: filtered,
      labelFor: (_r, s) => s[data.dimension] ?? "",
      warnings: ["Comparación descriptiva entre segmentos; no implica causalidad."],
    });
  });

// ---------- rank_geographies ----------
export const rankGeographies = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      metric_code: codeSchema,
      year: yearSchema.optional(),
      order: z.enum(["asc", "desc"]).default("desc"),
      limit: z.number().int().min(1).max(32).default(32),
    }),
  )
  .handler(async ({ data }) => {
    const db = publicDb();
    const metric = await getMetricMeta(db, data.metric_code);
    const rows = await queryFacts(db, { metric_code: data.metric_code, year: data.year, geo_level: "state", segmentKeyEmpty: true });
    const sorted = [...rows]
      .sort((a, b) => (data.order === "desc" ? b.estimate - a.estimate : a.estimate - b.estimate))
      .slice(0, data.limit);
    return buildEvidence(db, {
      fn: "rank_geographies",
      title: `${metric?.metric_label ?? "Métrica"} por entidad federativa`,
      metric,
      rows: sorted,
      warnings: [
        "Diferencias pequeñas entre entidades pueden no ser estadísticamente significativas mientras la precisión esté pendiente.",
      ],
    });
  });

// ---------- get_barriers ----------
export const getBarriers = createServerFn({ method: "GET" })
  .inputValidator(z.object({ year: yearSchema.optional(), geo_code: geoCodeSchema.optional(), segment: segmentSchema }))
  .handler(async ({ data }) => {
    const db = publicDb();
    const metric = await getMetricMeta(db, "nonbuyer_reason_pct_as_published");
    const rows = await queryFacts(db, {
      metric_code: "nonbuyer_reason_pct_as_published",
      year: data.year,
      geo_level: data.geo_code ? "state" : "national",
      geo_code: data.geo_code ?? "00",
      segment: data.segment,
    });
    return buildEvidence(db, {
      fn: "get_barriers",
      title: "Razones para no comprar por internet",
      metric,
      rows: [...rows].sort((a, b) => b.estimate - a.estimate),
      warnings: ["Respuesta múltiple: las razones no se suman ni equivalen al total de no compradores."],
    });
  });

// ---------- get_categories ----------
export const getCategories = createServerFn({ method: "GET" })
  .inputValidator(z.object({ year: yearSchema.optional(), geo_code: geoCodeSchema.optional(), segment: segmentSchema }))
  .handler(async ({ data }) => {
    const db = publicDb();
    const metric = await getMetricMeta(db, "online_purchase_category_pct");
    const rows = await queryFacts(db, {
      metric_code: "online_purchase_category_pct",
      year: data.year,
      geo_level: data.geo_code ? "state" : "national",
      geo_code: data.geo_code ?? "00",
      segment: data.segment,
    });
    return buildEvidence(db, {
      fn: "get_categories",
      title: "Categorías compradas por internet",
      metric,
      rows: [...rows].sort((a, b) => b.estimate - a.estimate),
      warnings: ["Respuesta múltiple: las categorías no se suman."],
    });
  });

// ---------- get_problems ----------
export const getProblems = createServerFn({ method: "GET" })
  .inputValidator(z.object({ year: yearSchema.optional() }))
  .handler(async ({ data }) => {
    const db = publicDb();
    let q = db.from("fact_problem").select("id").limit(1);
    if (data.year) q = q.eq("reference_year", data.year);
    const { data: probs } = await q;
    const ev = await buildEvidence(db, {
      fn: "get_problems",
      title: "Problemas reportados al comprar por internet",
      metric: null,
      rows: [],
    });
    if (probs?.length) ev.warnings.push("Hay problemas cargados pero aún no se publican en esta vista.");
    return ev;
  });

// ---------- get_opportunity_map ----------
export const getOpportunityMap = createServerFn({ method: "GET" })
  .inputValidator(z.object({ year: yearSchema.default(2025), segment: segmentSchema }))
  .handler(async ({ data }): Promise<OpportunityPayload> => {
    const db = publicDb();
    const segmentKey = exactSegmentKey(data.segment);
    const [users, hh, natUsersRows, natHhRows, geos] = await Promise.all([
      queryFacts(db, {
        metric_code: "internet_users_pct",
        year: data.year,
        geo_level: "state",
        segmentKey,
        segmentKeyEmpty: segmentKey === "",
      }),
      queryFacts(db, { metric_code: "households_with_internet_pct", year: data.year, geo_level: "state", segmentKeyEmpty: true }),
      queryFacts(db, {
        metric_code: "internet_users_pct",
        year: data.year,
        geo_level: "national",
        geo_code: "00",
        segmentKey,
        segmentKeyEmpty: segmentKey === "",
      }),
      queryFacts(db, { metric_code: "households_with_internet_pct", year: data.year, geo_level: "national", geo_code: "00", segmentKeyEmpty: true }),
      db.from("dim_geography").select("geo_code, geo_name").eq("geo_level", "state").order("geo_code"),
    ]);
    const natUsers = natUsersRows[0]?.estimate ?? null;
    const natHh = natHhRows[0]?.estimate ?? null;
    const u = new Map(users.map((r) => [r.geo_code, Number(r.estimate)]));
    const h = new Map(hh.map((r) => [r.geo_code, Number(r.estimate)]));
    const uPrec = new Map(users.map((r) => [r.geo_code, r.precision_flag]));
    const hPrec = new Map(hh.map((r) => [r.geo_code, r.precision_flag]));
    const points: OpportunityPoint[] = (geos.data ?? []).map((g) => {
      const up = u.get(g.geo_code) ?? null;
      const hp = h.get(g.geo_code) ?? null;
      let quadrant: OpportunityPoint["quadrant"] = null;
      if (segmentKey === "" && up != null && hp != null && natUsers != null && natHh != null) {
        quadrant = `${up >= Number(natUsers) ? "alto" : "bajo"}_${hp >= Number(natHh) ? "alto" : "bajo"}` as OpportunityPoint["quadrant"];
      }
      return {
        geo_code: g.geo_code,
        geo_name: g.geo_name,
        users_pct: up,
        households_pct: hp,
        users_precision: (uPrec.get(g.geo_code) as PrecisionFlag | undefined) ?? null,
        households_precision: (hPrec.get(g.geo_code) as PrecisionFlag | undefined) ?? null,
        quadrant,
      };
    });
    const evidence = await buildEvidence(db, {
      fn: "get_opportunity_map",
      title: "Mapa de oportunidad: uso individual vs. conexión del hogar",
      metric: await getMetricMeta(db, "internet_users_pct"),
      rows: [...users, ...hh],
      warnings: [
        segmentKey
          ? "El color de personas usa el segmento activo. Los hogares siguen el total estatal, sin ese corte, y el cuadrante queda vacío."
          : "Cuadrantes descriptivos respecto al promedio nacional publicado; no son una estimación de compra digital estatal.",
        "Personas (6 años y más) y hogares son universos distintos.",
        ...(segmentKey && !users.length ? ["Ese cruce estatal no está publicado en la malla. El mapa de personas queda sin cifra."] : []),
      ],
    });
    return {
      points,
      national_users_pct: natUsers != null ? Number(natUsers) : null,
      national_households_pct: natHh != null ? Number(natHh) : null,
      evidence,
    };
  });

// ---------- get_scenario ----------
export const getScenario = createServerFn({ method: "GET" })
  .inputValidator(z.object({ scenario_code: codeSchema.optional() }))
  .handler(async ({ data }): Promise<ScenarioPayload> => {
    const db = publicDb();
    const { data: defs } = await db
      .from("scenario_definition")
      .select("scenario_code, scenario_name, description")
      .eq("is_active", true);
    let q = db
      .from("scenario_result")
      .select("id, scenario_code, metric_code, reference_year, geo_level, geo_code, estimate, p10, p50, p90, unit, observed_or_modeled");
    if (data.scenario_code) q = q.eq("scenario_code", data.scenario_code);
    const { data: res } = await q.limit(500);
    const evidence = await buildEvidence(db, {
      fn: "get_scenario",
      title: "Escenarios 2030",
      metric: null,
      rows: [],
      warnings: ["Los escenarios son rangos bajo supuestos explícitos, no pronósticos oficiales."],
    });
    evidence.rows = (res ?? []).map((r) => ({
      id: r.id,
      label: r.scenario_code,
      estimate: Number(r.estimate),
      unit: r.unit,
      year: r.reference_year,
      geo_level: r.geo_level,
      geo_code: r.geo_code,
      geo_name: null,
      segment: {},
      standard_error: null,
      ci_low: r.p10,
      ci_high: r.p90,
      confidence_level: null,
      cv: null,
      precision_flag: "pending_microdata_recalculation",
      observed_or_modeled: "scenario",
      source_page: null,
      note: null,
    }));
    if (evidence.rows.length) evidence.warnings = evidence.warnings.filter((w) => !w.startsWith("Pendiente"));
    return { definitions: defs ?? [], evidence };
  });

// ---------- get_interventions ----------
export const getInterventions = createServerFn({ method: "GET" })
  .inputValidator(z.object({ barrier_code: codeSchema.optional() }))
  .handler(async ({ data }): Promise<InterventionItem[]> => {
    const db = publicDb();
    let q = db.from("intervention").select("intervention_code, intervention_name, barrier_code, description, implementation_actors, module_code, kpis, evaluation_design");
    if (data.barrier_code) q = q.eq("barrier_code", data.barrier_code);
    const { data: items, error } = await q;
    if (error) throw new Error("No fue posible leer el portafolio de intervenciones");
    if (!items?.length) return [];
    const { data: scores } = await db
      .from("intervention_score")
      .select("intervention_code, geo_code, reach, modeled_uplift, equity, feasibility, relative_cost, priority_score, model_version")
      .in("intervention_code", items.map((i) => i.intervention_code));
    return items.map((i) => ({
      ...i,
      kpis: (Array.isArray(i.kpis) ? i.kpis : []) as InterventionItem["kpis"],
      scores: (scores ?? []).filter((s) => s.intervention_code === i.intervention_code),
    }));
  });

// ---------- get_sources ----------
export const getSources = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(80).optional() }))
  .handler(async ({ data }): Promise<SourceCatalogItem[]> => {
    const db = publicDb();
    const { data: docs, error } = await db
      .from("source_document")
      .select("id, source_code, source_name, title, year, tier, resource_type, official_url, purpose, status, institution, edition, universe_description, geographic_coverage, modules_used, retrieved_at, sha256, updated_at")
      .order("tier")
      .order("source_name");
    if (error) throw new Error("No fue posible leer el catálogo de fuentes");
    const linked: { source_id: string; universe: string }[] = [];
    for (const table of ["fact_estimate", "fact_supply"] as const) {
      for (let from = 0; from < 30000; from += 1000) {
        const { data: page } = await db.from(table).select("source_id, universe").range(from, from + 999);
        linked.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
    }
    const term = data.q?.trim().toLowerCase();
    return (docs ?? [])
      .map((d) => {
        const f = linked.filter((x) => x.source_id === d.id);
        return { ...d, universes: [...new Set(f.map((x) => x.universe))], estimate_count: f.length };
      })
      .filter((d) =>
        !term
          ? true
          : [d.source_name, d.title, d.purpose ?? "", d.resource_type ?? ""].join(" ").toLowerCase().includes(term),
      );
  });

// ---------- methodology + filter options (read-only catalog helpers) ----------
export const getMethodology = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ notes: MethodologyNote[]; methods: { method_code: string; method_label: string; description: string; observed_or_modeled: string }[] }> => {
    const db = publicDb();
    const [{ data: notes }, { data: methods }, { data: docs }] = await Promise.all([
      db.from("methodology_note").select("note_code, title, body, topic, source_id"),
      db.from("dim_method").select("method_code, method_label, description, observed_or_modeled"),
      db.from("source_document").select("id, source_name"),
    ]);
    const names = new Map((docs ?? []).map((d) => [d.id, d.source_name]));
    return {
      notes: (notes ?? []).map((n) => ({
        note_code: n.note_code,
        title: n.title,
        body: n.body,
        topic: n.topic,
        source_name: n.source_id ? names.get(n.source_id) ?? null : null,
      })),
      methods: methods ?? [],
    };
  },
);

export const getFilterOptions = createServerFn({ method: "GET" }).handler(async (): Promise<FilterOptions> => {
  const db = publicDb();
  const [{ data: geos }, { data: segs }] = await Promise.all([
    db.from("dim_geography").select("geo_code, geo_name").eq("geo_level", "state").order("geo_code"),
    db.from("dim_segment").select("dimension, value"),
  ]);
  const yearRows: { reference_year: number }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await db.from("fact_estimate").select("reference_year").range(from, from + 999);
    yearRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const segments: Record<string, string[]> = {};
  for (const s of segs ?? []) (segments[s.dimension] ??= []).push(s.value);
  for (const key of Object.keys(segments)) segments[key] = [...new Set(segments[key])];
  return {
    years: [...new Set(yearRows.map((y) => y.reference_year))].sort((a, b) => b - a),
    geographies: geos ?? [],
    segments,
  };
});

// ---------- get_scenario_grid (precomputed results only; no fitting) ----------
export const getScenarioGrid = createServerFn({ method: "GET" })
  .inputValidator(z.object({ geo_code: geoCodeSchema.optional() }))
  .handler(async ({ data }): Promise<ScenarioGridPayload> => {
  const db = publicDb();
  const geo = data.geo_code ?? "00";
  const [{ data: defs, error }, { data: rows }, { data: metrics }] = await Promise.all([
    db.from("scenario_definition").select("scenario_code, scenario_name, description, assumptions").eq("is_active", true).order("scenario_code"),
    db
      .from("scenario_result")
      .select("id, scenario_code, metric_code, reference_year, geo_level, geo_code, segment_code, component_code, estimate, p10, p90, unit, assumptions_version, assumption_values")
      .eq("geo_code", geo)
      .limit(1000),
    db.from("dim_metric").select("metric_code, metric_label, default_unit, universe").like("metric_code", "scenario_%"),
  ]);
  if (error) throw new Error("No fue posible leer los escenarios");
  const ids = (rows ?? []).map((r) => r.id);
  const { data: lineage } = ids.length
    ? await db.from("source_lineage").select("fact_id, source_page, transformation, loaded_version, source_id").eq("fact_table", "scenario_result").in("fact_id", ids.slice(0, 500))
    : { data: [] };
  return {
    definitions: (defs ?? []).map((d) => ({ ...d, assumptions: (d.assumptions ?? {}) as { parameters?: import("@/lib/scenarios").ScenarioParam[] } })),
    rows: (rows ?? []).map((r) => ({
      ...r,
      estimate: Number(r.estimate),
      p10: r.p10 == null ? null : Number(r.p10),
      p90: r.p90 == null ? null : Number(r.p90),
      assumption_values: (r.assumption_values ?? {}) as Record<string, number>,
    })),
    metrics: metrics ?? [],
    lineage: (lineage ?? []).map((l) => ({ fact_id: l.fact_id, transformation: l.transformation, loaded_version: l.loaded_version, source_page: l.source_page })),
    generated_at: new Date().toISOString(),
  };
});

const MUNICIPAL_LAYERS = {
  dwellings_with_internet_pct: {
    year: 2020,
    title: "Viviendas con internet por municipio, Censo 2020",
    page: "ITER",
    warnings: [
      "Censo de Población y Vivienda 2020: viviendas particulares habitadas con internet (VPH_INTER / TVIVPARHAB) en la fila municipal del ITER. No es la ENDUTIH de personas.",
      "Cada punto es el centroide de las localidades del municipio, ponderado por población. No es el polígono municipal.",
    ],
  },
  eic_dwellings_with_internet_pct: {
    year: 2025,
    title: "Viviendas con internet por municipio, EIC 2025",
    page: "Vivienda 32",
    warnings: [
      "Encuesta Intercensal 2025, tabulado de bienes y TIC por municipio: porcentaje de viviendas particulares habitadas que disponen de internet. Universo de viviendas, no de personas ENDUTIH.",
      "El intervalo y el CV son los publicados por INEGI. El punto del mapa sigue siendo el centroide censal, no el polígono.",
    ],
  },
} as const;

export const getMunicipalInternet = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      indicator: z.enum(["dwellings_with_internet_pct", "eic_dwellings_with_internet_pct"]).default("dwellings_with_internet_pct"),
    }),
  )
  .handler(async ({ data }): Promise<MunicipalPayload> => {
  const layer = MUNICIPAL_LAYERS[data.indicator];
  const db = publicDb();
  const supply: {
    id: string;
    geo_code: string;
    estimate: number;
    source_id: string;
    method_id: string;
    universe: string;
    precision_flag: string;
    observed_or_modeled: string;
    unit: string;
    reference_year: number;
    ci_low: number | null;
    ci_high: number | null;
    cv: number | null;
  }[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data: page, error } = await db
      .from("fact_supply")
      .select("id, geo_code, estimate, source_id, method_id, universe, precision_flag, observed_or_modeled, unit, reference_year, ci_low, ci_high, cv")
      .eq("indicator_code", data.indicator)
      .eq("reference_year", layer.year)
      .eq("geo_level", "municipality")
      .range(from, from + 999);
    if (error) throw new Error("No fue posible leer la capa municipal");
    supply.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const geos: { geo_code: string; geo_name: string; parent_geo_code: string | null }[] = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data: page, error } = await db
      .from("dim_geography")
      .select("geo_code, geo_name, parent_geo_code")
      .eq("geo_level", "municipality")
      .order("geo_code")
      .range(from, from + 999);
    if (error) throw new Error("No fue posible leer los municipios");
    geos.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const byCode = new Map(supply.map((r) => [r.geo_code, r]));
  const points = geos.flatMap((g) => {
    const row = byCode.get(g.geo_code);
    if (!row) return [];
    return [{ geo_code: g.geo_code, geo_name: g.geo_name, parent_geo_code: g.parent_geo_code, estimate: Number(row.estimate) }];
  });
  const evidence = await buildEvidence(db, {
    fn: "get_municipal_internet",
    title: layer.title,
    metric: null,
    rows: supply.map((r) => ({
      id: r.id,
      metric_code: data.indicator,
      reference_year: r.reference_year,
      universe: r.universe,
      geo_level: "municipality",
      geo_code: r.geo_code,
      segment_json: {},
      estimate: Number(r.estimate),
      unit: r.unit,
      standard_error: null,
      ci_low: r.ci_low == null ? null : Number(r.ci_low),
      ci_high: r.ci_high == null ? null : Number(r.ci_high),
      confidence_level: r.ci_low == null ? null : 0.9,
      cv: r.cv == null ? null : Number(r.cv),
      precision_flag: r.precision_flag,
      observed_or_modeled: r.observed_or_modeled,
      source_page: layer.page,
      note: null,
      source_id: r.source_id,
      method_id: r.method_id,
    })),
    warnings: [...layer.warnings],
  });
  return { points, evidence };
});

const ACCESS_METRICS = [
  ["cnbv_branches_per_10k_adults", "branches"],
  ["cnbv_atms_per_10k_adults", "atms"],
  ["cnbv_correspondents_per_10k_adults", "correspondents"],
  ["cnbv_pos_terminals_per_10k_adults", "pos"],
] as const;

export const getFinancialAccess = createServerFn({ method: "GET" }).handler(async (): Promise<FinancialAccessPayload> => {
  const db = publicDb();
  const metric = await getMetricMeta(db, "cnbv_branches_per_10k_adults");
  const grouped = new Map<string, FinancialAccessPayload["rows"][number]>();
  let branchRows: Awaited<ReturnType<typeof queryFacts>> = [];
  for (const [code, key] of ACCESS_METRICS) {
    const [national, states] = await Promise.all([
      queryFacts(db, { metric_code: code, year: 2026, geo_level: "national", geo_code: "00", segmentKeyEmpty: true }),
      queryFacts(db, { metric_code: code, year: 2026, geo_level: "state", segmentKeyEmpty: true }),
    ]);
    const rows = [...national, ...states];
    if (key === "branches") branchRows = rows;
    for (const row of rows) {
      const current = grouped.get(row.geo_code) ?? {
        geo_code: row.geo_code,
        geo_name: null,
        branches: null,
        atms: null,
        correspondents: null,
        pos: null,
      };
      current[key] = Number(row.estimate);
      grouped.set(row.geo_code, current);
    }
  }
  const evidence = await buildEvidence(db, {
    fn: "get_financial_access",
    title: "Sucursales por 10 mil adultos",
    metric,
    rows: branchRows,
    warnings: [
      "Cociente de sucursales y población adulta publicadas en la misma fila de la CNBV, cierre a marzo 2026. No es una estimación muestral y no trae intervalo.",
      "Cajeros, corresponsales y terminales punto de venta usan el mismo cociente y la misma hoja.",
    ],
  });
  const names = new Map(evidence.rows.map((row) => [row.geo_code, row.geo_name]));
  const rows = [...grouped.values()]
    .map((row) => ({ ...row, geo_name: names.get(row.geo_code) ?? row.geo_code }))
    .sort((a, b) => (a.geo_code === "00" ? -1 : b.geo_code === "00" ? 1 : (b.branches ?? -1) - (a.branches ?? -1)));
  return { evidence, rows };
});

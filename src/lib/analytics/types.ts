import { z } from "zod";

export const observedOrModeled = z.enum(["observed", "modeled", "imputed", "scenario"]);
export type ObservedOrModeled = z.infer<typeof observedOrModeled>;

export const precisionFlag = z.enum([
  "high",
  "moderate",
  "low",
  "unreliable",
  "pending_microdata_recalculation",
]);
export type PrecisionFlag = z.infer<typeof precisionFlag>;

export const yearSchema = z.number().int().min(1990).max(2100);
export const codeSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/);
export const geoCodeSchema = z.string().regex(/^\d{2,5}$/);

export type EvidenceRow = {
  id: string;
  label: string;
  estimate: number;
  unit: string;
  year: number;
  geo_level: string;
  geo_code: string;
  geo_name: string | null;
  segment: Record<string, string>;
  standard_error: number | null;
  ci_low: number | null;
  ci_high: number | null;
  confidence_level: number | null;
  cv: number | null;
  precision_flag: PrecisionFlag;
  observed_or_modeled: ObservedOrModeled;
  source_page: string | null;
  note: string | null;
};

export type EvidenceSource = {
  source_code: string;
  source_name: string;
  official_url: string;
  year: number | null;
  pages: string[];
};

export type EvidenceMethod = {
  method_code: string;
  method_label: string;
  description: string;
  observed_or_modeled: ObservedOrModeled;
};

export type MetricMeta = {
  metric_code: string;
  metric_label: string;
  description: string | null;
  default_unit: string;
  universe: string;
  universe_type: string;
  status: string;
};

export type EvidencePayload = {
  fn: string;
  title: string;
  metric: MetricMeta | null;
  rows: EvidenceRow[];
  universe: string | null;
  years: number[];
  sources: EvidenceSource[];
  methods: EvidenceMethod[];
  observed_or_modeled: ObservedOrModeled[];
  uncertainty: {
    precision_flags: PrecisionFlag[];
    has_intervals: boolean;
  };
  warnings: string[];
  generated_at: string;
};

export type SourceCatalogItem = {
  id: string;
  source_code: string;
  source_name: string;
  title: string;
  year: number | null;
  tier: string | null;
  resource_type: string | null;
  official_url: string;
  purpose: string | null;
  status: string;
  institution: string | null;
  edition: string | null;
  universe_description: string | null;
  geographic_coverage: string | null;
  modules_used: string[];
  retrieved_at: string | null;
  sha256: string | null;
  updated_at: string;
  universes: string[];
  estimate_count: number;
};

export type MethodologyNote = {
  note_code: string;
  title: string;
  body: string;
  topic: string;
  source_name: string | null;
};

export type ScenarioPayload = {
  definitions: { scenario_code: string; scenario_name: string; description: string }[];
  evidence: EvidencePayload;
};

export type InterventionItem = {
  intervention_code: string;
  intervention_name: string;
  barrier_code: string;
  description: string;
  implementation_actors: string[];
  module_code: string | null;
  kpis: { kpi?: string; m3?: string; m6?: string; m12?: string }[];
  evaluation_design: string | null;
  scores: {
    geo_code: string;
    reach: number | null;
    modeled_uplift: number | null;
    equity: number | null;
    feasibility: number | null;
    relative_cost: number | null;
    priority_score: number | null;
    model_version: string;
  }[];
};

export type OpportunityPoint = {
  geo_code: string;
  geo_name: string;
  users_pct: number | null;
  households_pct: number | null;
  users_precision: PrecisionFlag | null;
  households_precision: PrecisionFlag | null;
  quadrant: "alto_alto" | "alto_bajo" | "bajo_alto" | "bajo_bajo" | null;
};

export type OpportunityPayload = {
  points: OpportunityPoint[];
  national_users_pct: number | null;
  national_households_pct: number | null;
  evidence: EvidencePayload;
};

export type FilterOptions = {
  years: number[];
  geographies: { geo_code: string; geo_name: string }[];
  segments: Record<string, string[]>;
};

export type ScenarioGridPayload = {
  definitions: { scenario_code: string; scenario_name: string; description: string; assumptions: { parameters?: import("@/lib/scenarios").ScenarioParam[] } }[];
  rows: import("@/lib/scenarios").ScenarioRow[];
  metrics: { metric_code: string; metric_label: string; default_unit: string; universe: string }[];
  lineage: { fact_id: string; transformation: string; loaded_version: string; source_page: string | null }[];
  generated_at: string;
};

import { queryOptions } from "@tanstack/react-query";
import {
  compareSegments,
  getBarriers,
  getCategories,
  getFilterOptions,
  getInterventions,
  getMethodology,
  getMetric,
  getOpportunityMap,
  getMunicipalInternet,
  getScenario,
  getScenarioGrid,
  getSources,
  rankGeographies,
} from "@/lib/analytics.functions";

const stale = 5 * 60_000;

export type MetricQueryOpts = {
  year?: number;
  geo_code?: string;
  segment?: Record<string, string>;
  total_only?: boolean;
};

export const metricQuery = (metric_code: string, opts: MetricQueryOpts = {}) =>
  queryOptions({
    queryKey: ["metric", metric_code, opts],
    queryFn: () =>
      getMetric({
        data: {
          metric_code,
          year: opts.year,
          geo_level: opts.geo_code ? "state" : "national",
          geo_code: opts.geo_code ?? "00",
          segment: opts.segment,
          total_only: opts.segment ? false : (opts.total_only ?? true),
        },
      }),
    staleTime: stale,
  });

export type SegmentDimension = "sex" | "area" | "age_group" | "use_type" | "schooling" | "income_decile";

export const segmentsQuery = (
  metric_code: string,
  dimension: SegmentDimension,
  year?: number,
  within?: Record<string, string>,
  geo_code?: string,
) =>
  queryOptions({
    queryKey: ["segments", metric_code, dimension, year ?? null, within ?? null, geo_code ?? null],
    queryFn: () => compareSegments({ data: { metric_code, dimension, year, within, geo_code } }),
    staleTime: stale,
  });

export const rankQuery = (metric_code: string, year?: number) =>
  queryOptions({
    queryKey: ["rank", metric_code, year],
    queryFn: () => rankGeographies({ data: { metric_code, year, order: "desc", limit: 32 } }),
    staleTime: stale,
  });

export const barriersQuery = (year?: number, opts: { geo_code?: string; segment?: Record<string, string> } = {}) =>
  queryOptions({
    queryKey: ["barriers", year ?? null, opts],
    queryFn: () => getBarriers({ data: { year, geo_code: opts.geo_code, segment: opts.segment } }),
    staleTime: stale,
  });

export const categoriesQuery = (year?: number, opts: { geo_code?: string; segment?: Record<string, string> } = {}) =>
  queryOptions({
    queryKey: ["categories", year ?? null, opts],
    queryFn: () => getCategories({ data: { year, geo_code: opts.geo_code, segment: opts.segment } }),
    staleTime: stale,
  });

export const opportunityQuery = (year = 2025, segment?: Record<string, string>) =>
  queryOptions({
    queryKey: ["opportunity", year, segment ?? null],
    queryFn: () => getOpportunityMap({ data: segment ? { year, segment } : { year } }),
    staleTime: stale,
  });

export const scenarioQuery = () =>
  queryOptions({ queryKey: ["scenario"], queryFn: () => getScenario({ data: {} }), staleTime: stale });

export const interventionsQuery = () =>
  queryOptions({ queryKey: ["interventions"], queryFn: () => getInterventions({ data: {} }), staleTime: stale });

export const sourcesQuery = () =>
  queryOptions({ queryKey: ["sources"], queryFn: () => getSources({ data: {} }), staleTime: stale });

export const methodologyQuery = () =>
  queryOptions({ queryKey: ["methodology"], queryFn: () => getMethodology(), staleTime: stale });

export const filterOptionsQuery = () =>
  queryOptions({ queryKey: ["filter-options"], queryFn: () => getFilterOptions(), staleTime: stale });

export const scenarioGridQuery = (geo_code = "00") =>
  queryOptions({
    queryKey: ["scenario-grid", geo_code],
    queryFn: () => getScenarioGrid({ data: { geo_code } }),
    staleTime: stale,
  });

export const municipalInternetQuery = (indicator: "dwellings_with_internet_pct" | "eic_dwellings_with_internet_pct" = "dwellings_with_internet_pct") =>
  queryOptions({
    queryKey: ["municipal-internet", indicator],
    queryFn: () => getMunicipalInternet({ data: { indicator } }),
    staleTime: stale,
  });

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
  getScenario,
  getSources,
  rankGeographies,
} from "@/lib/analytics.functions";

const stale = 5 * 60_000;

export const metricQuery = (metric_code: string, opts: { year?: number; total_only?: boolean } = {}) =>
  queryOptions({
    queryKey: ["metric", metric_code, opts],
    queryFn: () => getMetric({ data: { metric_code, ...opts } }),
    staleTime: stale,
  });

export const segmentsQuery = (metric_code: string, dimension: "sex" | "area" | "age_group" | "use_type", year?: number) =>
  queryOptions({
    queryKey: ["segments", metric_code, dimension, year],
    queryFn: () => compareSegments({ data: { metric_code, dimension, year } }),
    staleTime: stale,
  });

export const rankQuery = (metric_code: string, year?: number) =>
  queryOptions({
    queryKey: ["rank", metric_code, year],
    queryFn: () => rankGeographies({ data: { metric_code, year, order: "desc", limit: 32 } }),
    staleTime: stale,
  });

export const barriersQuery = (year?: number) =>
  queryOptions({ queryKey: ["barriers", year], queryFn: () => getBarriers({ data: { year } }), staleTime: stale });

export const categoriesQuery = (year?: number) =>
  queryOptions({ queryKey: ["categories", year], queryFn: () => getCategories({ data: { year } }), staleTime: stale });

export const opportunityQuery = (year = 2025) =>
  queryOptions({ queryKey: ["opportunity", year], queryFn: () => getOpportunityMap({ data: { year } }), staleTime: stale });

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

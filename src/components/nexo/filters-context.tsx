import type React from "react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type GlobalFilterState = {
  year: number | null;
  geo_code: string | null;
  area: string | null;
  sex: string | null;
  age_group: string | null;
  schooling: string | null;
  income_decile: string | null;
};

const initial: GlobalFilterState = {
  year: null,
  geo_code: null,
  area: null,
  sex: null,
  age_group: null,
  schooling: null,
  income_decile: null,
};

export type TourId = "finanzas" | "genero" | "rural";

export const TOURS: { id: TourId; title: string; to: "/segmentos" | "/explorar"; detail: string; filters: GlobalFilterState }[] = [
  {
    id: "finanzas",
    title: "Vulnerabilidad financiera",
    to: "/segmentos",
    detail: "Deja el decil 1 de ingreso imputado y abre la comparación dentro de ese decil.",
    filters: { ...initial, year: 2025, income_decile: "Decil 1" },
  },
  {
    id: "genero",
    title: "Brecha de género",
    to: "/segmentos",
    detail: "Limpia el filtro de sexo para que hombres y mujeres se vean juntos.",
    filters: { ...initial, year: 2025 },
  },
  {
    id: "rural",
    title: "Brecha rural-urbana",
    to: "/explorar",
    detail: "Limpia el ámbito y abre el panorama urbano-rural.",
    filters: { ...initial, year: 2025 },
  },
];

type Ctx = {
  filters: GlobalFilterState;
  setFilter: <K extends keyof GlobalFilterState>(k: K, v: GlobalFilterState[K]) => void;
  reset: () => void;
  activeCount: number;
  tour: TourId | null;
  applyTour: (id: TourId) => void;
};

const g = globalThis as unknown as { __nexoFiltersCtx?: React.Context<Ctx | null> };
const FiltersContext = (g.__nexoFiltersCtx ??= createContext<Ctx | null>(null));

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(initial);
  const [tour, setTour] = useState<TourId | null>(null);
  const value = useMemo<Ctx>(
    () => ({
      filters,
      setFilter: (k, v) => {
        setTour(null);
        setFilters((f) => ({ ...f, [k]: v }));
      },
      reset: () => {
        setTour(null);
        setFilters(initial);
      },
      activeCount: Object.values(filters).filter((v) => v != null).length,
      tour,
      applyTour: (id) => {
        const next = TOURS.find((item) => item.id === id);
        if (!next) return;
        setTour(id);
        setFilters(next.filters);
      },
    }),
    [filters, tour],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used inside FiltersProvider");
  return ctx;
}

/** Segment keys the analytical tables can store. */
export function segmentFromFilters(filters: GlobalFilterState): Record<string, string> | undefined {
  const segment: Record<string, string> = {};
  if (filters.area) segment["area"] = filters.area;
  if (filters.sex) segment["sex"] = filters.sex;
  if (filters.age_group) segment["age_group"] = filters.age_group;
  if (filters.schooling) segment["schooling"] = filters.schooling;
  if (filters.income_decile) segment["income_decile"] = filters.income_decile;
  return Object.keys(segment).length ? segment : undefined;
}

export function withinExcept(filters: GlobalFilterState, dimension: string): Record<string, string> | undefined {
  const segment = segmentFromFilters(filters);
  if (!segment) return undefined;
  const rest = Object.fromEntries(Object.entries(segment).filter(([key]) => key !== dimension));
  return Object.keys(rest).length ? rest : undefined;
}

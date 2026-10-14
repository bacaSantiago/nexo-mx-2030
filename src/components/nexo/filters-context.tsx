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

type Ctx = {
  filters: GlobalFilterState;
  setFilter: <K extends keyof GlobalFilterState>(k: K, v: GlobalFilterState[K]) => void;
  reset: () => void;
  activeCount: number;
};

const FiltersContext = createContext<Ctx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState(initial);
  const value = useMemo<Ctx>(
    () => ({
      filters,
      setFilter: (k, v) => setFilters((f) => ({ ...f, [k]: v })),
      reset: () => setFilters(initial),
      activeCount: Object.values(filters).filter((v) => v != null).length,
    }),
    [filters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used inside FiltersProvider");
  return ctx;
}

import type { ObservedOrModeled, PrecisionFlag } from "@/lib/analytics/types";

export function formatValue(value: number | null | undefined, unit: string): string {
  if (value == null || Number.isNaN(value)) return "Pendiente de carga";
  const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
  if (unit === "percent") return `${nf.format(value)} %`;
  if (unit === "millones de personas") return `${nf.format(value)} M`;
  if (unit === "millones de pesos") return `$${new Intl.NumberFormat("es-MX").format(value)} M`;
  return `${nf.format(value)} ${unit}`;
}

export function unitLabel(unit: string): string {
  if (unit === "percent") return "Porcentaje (%)";
  if (unit === "millones de personas") return "Millones de personas";
  if (unit === "millones de pesos") return "Millones de pesos corrientes";
  return unit;
}

export const OOM_LABEL: Record<ObservedOrModeled, string> = {
  observed: "Dato observado",
  modeled: "Estimación modelada",
  imputed: "Ingreso imputado",
  scenario: "Escenario",
};

export const PRECISION_LABEL: Record<PrecisionFlag, string> = {
  high: "Precisión alta",
  moderate: "Precisión moderada",
  low: "Precisión baja",
  unreliable: "No confiable",
  pending_microdata_recalculation: "Precisión pendiente",
};

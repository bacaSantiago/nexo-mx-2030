/** Pure helpers for reading precomputed scenario grids. No model fitting happens here. */

export type ScenarioParam = { key: string; label: string; unit?: string; min: number; max: number; step?: number; default: number };

export type ScenarioRow = {
  id: string;
  scenario_code: string;
  metric_code: string;
  reference_year: number;
  geo_level: string;
  geo_code: string;
  segment_code: string;
  component_code: string;
  estimate: number;
  p10: number | null;
  p90: number | null;
  unit: string;
  assumptions_version: string;
  assumption_values: Record<string, number>;
};

export type ResolvedValue = {
  estimate: number;
  p10: number | null;
  p90: number | null;
  interpolated: boolean;
  basis: string[]; // grid row ids used
};

export function parseParams(assumptions: unknown): ScenarioParam[] {
  const list = (assumptions as { parameters?: unknown })?.parameters;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (p): p is ScenarioParam =>
      !!p && typeof p === "object" && typeof (p as ScenarioParam).key === "string" &&
      Number.isFinite((p as ScenarioParam).min) && Number.isFinite((p as ScenarioParam).max) &&
      (p as ScenarioParam).min <= (p as ScenarioParam).max,
  );
}

export function defaultValues(params: ScenarioParam[]) {
  return Object.fromEntries(params.map((p) => [p.key, Math.min(p.max, Math.max(p.min, p.default))]));
}

const eq = (a: number | undefined, b: number | undefined) => a != null && b != null && Math.abs(a - b) < 1e-9;
const lerp = (a: number | null, b: number | null, t: number) => (a == null || b == null ? null : a + (b - a) * t);

/**
 * Select an exact grid point, or interpolate linearly along ONE parameter between two
 * approved grid points. Returns null when the request is outside the approved grid
 * (never extrapolates) or when more than one parameter is off-grid.
 */
export function resolvePoint(rows: ScenarioRow[], values: Record<string, number>, params: ScenarioParam[]): ResolvedValue | null {
  if (!rows.length) return null;
  for (const p of params) {
    const v = values[p.key];
    if (v == null || v < p.min || v > p.max) return null;
  }
  const exact = rows.find((r) => params.every((p) => eq(r.assumption_values[p.key], values[p.key])));
  if (exact) return { estimate: exact.estimate, p10: exact.p10, p90: exact.p90, interpolated: false, basis: [exact.id] };
  if (!params.length) {
    const only = rows[0]!;
    return { estimate: only.estimate, p10: only.p10, p90: only.p90, interpolated: false, basis: [only.id] };
  }
  for (const free of params) {
    const others = params.filter((p) => p.key !== free.key);
    const line = rows
      .filter((r) => others.every((p) => eq(r.assumption_values[p.key], values[p.key])) && r.assumption_values[free.key] != null)
      .sort((a, b) => a.assumption_values[free.key]! - b.assumption_values[free.key]!);
    const v = values[free.key]!;
    for (let i = 0; i < line.length - 1; i++) {
      const lo = line[i]!;
      const hi = line[i + 1]!;
      const a = lo.assumption_values[free.key]!;
      const b = hi.assumption_values[free.key]!;
      if (v > a && v < b) {
        const t = (v - a) / (b - a);
        return { estimate: lerp(lo.estimate, hi.estimate, t)!, p10: lerp(lo.p10, hi.p10, t), p90: lerp(lo.p90, hi.p90, t), interpolated: true, basis: [lo.id, hi.id] };
      }
    }
  }
  return null;
}

export function groupBy<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const arr = m.get(k);
    if (arr) arr.push(x);
    else m.set(k, [x]);
  }
  return m;
}

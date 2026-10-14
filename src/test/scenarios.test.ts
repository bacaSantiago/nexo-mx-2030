import { describe, expect, it } from "vitest";
import { resolvePoint, type ScenarioRow, type ScenarioParam } from "@/lib/scenarios";

const params: ScenarioParam[] = [{ key: "access", label: "Acceso", min: 0, max: 10, default: 0 }];
const row = (id: string, a: number, est: number): ScenarioRow => ({
  id, scenario_code: "s1", metric_code: "m", reference_year: 2030, geo_level: "national", geo_code: "00", segment_code: "", component_code: "",
  estimate: est, p10: est - 1, p90: est + 1, unit: "percent", assumptions_version: "v1", assumption_values: { access: a },
});
const grid = [row("a", 0, 40), row("b", 5, 50), row("c", 10, 60)];

describe("scenario grid", () => {
  it("selects exact grid points", () => {
    expect(resolvePoint(grid, { access: 5 }, params)).toMatchObject({ estimate: 50, interpolated: false });
  });
  it("interpolates and marks it", () => {
    expect(resolvePoint(grid, { access: 2.5 }, params)).toMatchObject({ estimate: 45, interpolated: true, basis: ["a", "b"] });
  });
  it("never extrapolates", () => {
    expect(resolvePoint(grid, { access: 12 }, params)).toBeNull();
    expect(resolvePoint(grid.slice(0, 2), { access: 7 }, params)).toBeNull();
  });
});

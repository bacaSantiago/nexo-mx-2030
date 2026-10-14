import { useEffect, useRef, useState } from "react";
import type { OpportunityPoint, PrecisionFlag } from "@/lib/analytics/types";
import "maplibre-gl/dist/maplibre-gl.css";

export const CHORO_BREAKS = [70, 75, 80, 85, 90];

/** MapLibre cannot parse oklch: resolve the design token to rgb via a canvas. */
function cssVar(name: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return "rgb(200,200,200)";
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

/** Client-only MapLibre choropleth without external basemap tiles. */
export function ChoroplethMap({
  points,
  metric,
  mode,
  precision,
}: {
  points: OpportunityPoint[];
  metric: "users_pct" | "households_pct";
  mode: "value" | "precision";
  precision: Record<string, PrecisionFlag>;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("maplibre-gl");
        const maplibre = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
        const workerUrl = (await import("maplibre-gl/dist/maplibre-gl-csp-worker.js?url")).default;
        maplibre.setWorkerUrl(workerUrl);
        const geo = await fetch("/geo/mx_states.json").then((r) => r.json());
        if (cancelled || !el.current) return;
        const map = new maplibre.Map({
          container: el.current,
          style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": cssVar("--background") } }] },
          bounds: [[-118.5, 14.3], [-86.5, 32.8]],
          fitBoundsOptions: { padding: 12 },
          attributionControl: false,
          dragRotate: false,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          map.addSource("states", { type: "geojson", data: geo, promoteId: "geo_code" });
          map.addLayer({ id: "fill", type: "fill", source: "states", paint: { "fill-color": cssVar("--muted"), "fill-opacity": 0.95 } });
          map.addLayer({ id: "line", type: "line", source: "states", paint: { "line-color": cssVar("--card"), "line-width": 0.8 } });
          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false });
          map.on("mousemove", "fill", (e: import("maplibre-gl").MapLayerMouseEvent) => {
            const f = e.features?.[0];
            const code = f?.properties?.["geo_code"] as string | undefined;
            const txt = (map as unknown as { __labels?: Record<string, string> }).__labels?.[code ?? ""];
            if (txt) popup.setLngLat(e.lngLat).setHTML(`<div style="font:12px Manrope,sans-serif">${txt}</div>`).addTo(map);
          });
          map.on("mouseleave", "fill", () => popup.remove());
          setReady(true);
        });
        mapRef.current = map;
      } catch {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const colors: string[] = [1, 2, 3, 4, 5].map((i) => cssVar(`--choro-${i}`));
    const pending = cssVar("--warning-soft");
    const missing = cssVar("--muted");
    const expr: unknown[] = ["match", ["get", "geo_code"]];
    const labels: Record<string, string> = {};
    for (const p of points) {
      const v = p[metric];
      let c: string = missing;
      if (mode === "precision") c = v == null ? missing : precision[p.geo_code] === "pending_microdata_recalculation" ? pending : (colors[3] ?? missing);
      else if (v != null) c = colors[Math.min(CHORO_BREAKS.filter((b) => v >= b).length, 4)] ?? missing;
      expr.push(p.geo_code, c);
      // sanitized: only numbers and DB state names (escaped)
      const name = p.geo_name.replace(/[<>&"]/g, "");
      labels[p.geo_code] = `<strong>${name}</strong><br/>${v == null ? "Pendiente de carga" : `${v.toFixed(1)} %`}`;
    }
    expr.push(missing);
    map.setPaintProperty("fill", "fill-color", expr as never);
    (map as unknown as { __labels?: Record<string, string> }).__labels = labels;
  }, [points, metric, mode, precision, ready]);

  if (failed) return <p className="p-6 text-sm text-muted-foreground">El mapa no pudo cargarse. Consulta la tabla accesible.</p>;
  return <div ref={el} className="h-[340px] w-full overflow-hidden rounded-md sm:h-[440px]" role="img" aria-label="Mapa coroplético por entidad federativa" />;
}

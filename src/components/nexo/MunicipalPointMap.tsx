import { useEffect, useRef, useState } from "react";
import type { MunicipalPoint } from "@/lib/analytics/types";
import "maplibre-gl/dist/maplibre-gl.css";

const BREAKS = [20, 35, 50, 65];

type Geom = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type MunFeature = { type: "Feature"; geometry: Geom; properties?: Record<string, unknown> | null };
type MunCollection = { type: "FeatureCollection"; features: MunFeature[] };

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

function walkCoords(coords: unknown, visit: (lng: number, lat: number) => void) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number") {
    visit(coords[0] as number, coords[1] as number);
    return;
  }
  for (const child of coords) walkCoords(child, visit);
}

function boundsOf(features: MunFeature[]): [[number, number], [number, number]] | null {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  let any = false;
  for (const feature of features) {
    walkCoords(feature.geometry.coordinates, (lng, lat) => {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      any = true;
    });
  }
  return any ? [[west, south], [east, north]] : null;
}

/** Choropleth of municipal polygons. Coordinates live in the local GeoJSON; the percent comes from the database. */
export function MunicipalPointMap({ points, focus }: { points: MunicipalPoint[]; focus: string | null }) {
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
        const workerUrl = (await import("maplibre-gl/dist/maplibre-gl-worker.mjs?url")).default;
        maplibre.setWorkerUrl(workerUrl);
        const geo = (await fetch("/geo/mx_municipalities_poly.json").then((r) => {
          if (!r.ok) throw new Error("geo");
          return r.json();
        })) as MunCollection;
        if (cancelled || !el.current) return;
        const map = new maplibre.Map({
          container: el.current,
          canvasContextAttributes: { preserveDrawingBuffer: true },
          style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": cssVar("--background") } }] },
          bounds: [[-118.5, 14.3], [-86.5, 32.8]],
          fitBoundsOptions: { padding: 12 },
          attributionControl: false,
          dragRotate: false,
        });
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          map.addSource("mun", { type: "geojson", data: geo, promoteId: "geo_code" });
          map.addLayer({
            id: "mun",
            type: "fill",
            source: "mun",
            paint: { "fill-color": cssVar("--muted"), "fill-opacity": 0.9 },
          });
          map.addLayer({
            id: "mun-line",
            type: "line",
            source: "mun",
            paint: { "line-color": cssVar("--card"), "line-width": 0.6 },
          });
          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false });
          map.on("mousemove", "mun", (e: import("maplibre-gl").MapLayerMouseEvent) => {
            const f = e.features?.[0];
            const code = f?.properties?.["geo_code"] as string | undefined;
            const txt = (map as unknown as { __labels?: Record<string, string> }).__labels?.[code ?? ""];
            if (txt) popup.setLngLat(e.lngLat).setHTML(`<div style="font:12px Manrope,sans-serif">${txt}</div>`).addTo(map);
          });
          map.on("mouseleave", "mun", () => popup.remove());
          (map as unknown as { __geo?: MunCollection }).__geo = geo;
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
    const colors = [1, 2, 3, 4, 5].map((i) => cssVar(`--choro-${i}`));
    const byCode = new Map(points.map((p) => [p.geo_code, p]));
    const base = (map as unknown as { __geo?: MunCollection }).__geo;
    if (!base) return;
    const features = base.features.flatMap((feature) => {
      const code = String(feature.properties?.["geo_code"] ?? "");
      const point = byCode.get(code);
      if (!point) return [];
      return [{ ...feature, properties: { ...feature.properties, estimate: point.estimate } }];
    });
    const source = map.getSource("mun") as import("maplibre-gl").GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features });
    const c = (i: number) => colors[i] ?? "rgb(128,128,128)";
    const b = (i: number) => BREAKS[i] ?? 0;
    map.setPaintProperty("mun", "fill-color", [
      "step",
      ["get", "estimate"],
      c(0),
      b(0),
      c(1),
      b(1),
      c(2),
      b(2),
      c(3),
      b(3),
      c(4),
    ]);
    const labels: Record<string, string> = {};
    for (const point of points) {
      const name = point.geo_name.replace(/[<>&"]/g, "");
      labels[point.geo_code] = `<strong>${name}</strong><br/>${point.estimate.toFixed(1)} %`;
    }
    (map as unknown as { __labels?: Record<string, string> }).__labels = labels;
    const bounds = boundsOf(features);
    if (bounds) map.fitBounds(bounds, { padding: 24, duration: 0, maxZoom: features.length === 1 ? 9 : 6 });
  }, [points, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    const base = (map as unknown as { __geo?: MunCollection }).__geo;
    const feature = base?.features.find((f) => f.properties?.["geo_code"] === focus);
    if (!feature) return;
    const bounds = boundsOf([feature]);
    if (bounds) map.fitBounds(bounds, { padding: 32, maxZoom: 9 });
  }, [focus, ready]);

  if (failed) return <p className="p-6 text-sm text-muted-foreground">El mapa municipal no pudo cargarse. Consulta la tabla.</p>;
  return <div ref={el} className="h-[340px] w-full overflow-hidden rounded-md sm:h-[440px]" role="img" aria-label="Coropleta municipal de viviendas con internet" />;
}

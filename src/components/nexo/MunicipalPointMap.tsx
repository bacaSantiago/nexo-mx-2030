import { useEffect, useRef, useState } from "react";
import type { MunicipalPoint } from "@/lib/analytics/types";
import "maplibre-gl/dist/maplibre-gl.css";

const BREAKS = [20, 35, 50, 65];

type PointGeom = { type: "Point"; coordinates: number[] };
type MunFeature = { type: "Feature"; geometry: PointGeom; properties?: Record<string, unknown> | null };
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

/** Point layer. Coordinates live in the local GeoJSON; the percent comes from the database. */
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
        const geo = await fetch("/geo/mx_municipalities.json").then((r) => r.json());
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
            type: "circle",
            source: "mun",
            paint: {
              "circle-radius": 3.2,
              "circle-color": cssVar("--muted"),
              "circle-stroke-width": 0.4,
              "circle-stroke-color": cssVar("--card"),
            },
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
    map.setPaintProperty("mun", "circle-color", [
      "step",
      ["get", "estimate"],
      colors[0],
      BREAKS[0],
      colors[1],
      BREAKS[1],
      colors[2],
      BREAKS[2],
      colors[3],
      BREAKS[3],
      colors[4],
    ]);
    const labels: Record<string, string> = {};
    for (const point of points) {
      const name = point.geo_name.replace(/[<>&"]/g, "");
      labels[point.geo_code] = `<strong>${name}</strong><br/>${point.estimate.toFixed(1)} %`;
    }
    (map as unknown as { __labels?: Record<string, string> }).__labels = labels;
    if (features.length) {
      let west = 180;
      let south = 90;
      let east = -180;
      let north = -90;
      for (const feature of features) {
        const coords = feature.geometry.coordinates;
        const lng = coords[0] ?? 0;
        const lat = coords[1] ?? 0;
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
      if (features.length === 1) {
        const coords = features[0]?.geometry.coordinates;
        map.flyTo({ center: [coords[0] ?? 0, coords[1] ?? 0], zoom: 8 });
      } else {
        map.fitBounds([[west, south], [east, north]], { padding: 24, duration: 0 });
      }
    }
  }, [points, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !focus) return;
    const base = (map as unknown as { __geo?: MunCollection }).__geo;
    const feature = base?.features.find((f) => f.properties?.["geo_code"] === focus);
    const coords = feature?.geometry.coordinates;
    if (coords) map.flyTo({ center: [coords[0] ?? 0, coords[1] ?? 0], zoom: 8 });
  }, [focus, ready]);

  if (failed) return <p className="p-6 text-sm text-muted-foreground">El mapa municipal no pudo cargarse. Consulta la tabla.</p>;
  return <div ref={el} className="h-[340px] w-full overflow-hidden rounded-md sm:h-[440px]" role="img" aria-label="Mapa de puntos municipales de viviendas con internet" />;
}

import type { EvidencePayload } from "@/lib/analytics/types";
import { formatValue, OOM_LABEL } from "@/lib/format";

export type ExportFilters = Record<string, string | number | null | undefined>;

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function filtersText(f: ExportFilters) {
  const e = Object.entries(f).filter(([, v]) => v != null && v !== "");
  return e.length ? e.map(([k, v]) => `${k}=${v}`).join("; ") : "sin filtros";
}

/** Metadata block included in every export. No prompts, logs or internal ids beyond public row ids. */
export function exportMeta(e: EvidencePayload, filters: ExportFilters) {
  return [
    ["titulo", e.title],
    ["fuente", e.sources.map((s) => `${s.source_name} (${s.official_url})`).join(" | ") || "Pendiente de carga"],
    ["universo", e.universe ?? "Pendiente de carga"],
    ["condicion", e.observed_or_modeled.map((o) => OOM_LABEL[o]).join(", ") || "—"],
    ["metodo", e.methods.map((m) => m.method_label).join(", ") || "—"],
    ["filtros", filtersText(filters)],
    ["generado", new Date().toISOString()],
  ] as const;
}

export function evidenceToCsv(e: EvidencePayload, filters: ExportFilters) {
  const meta = exportMeta(e, filters).map(([k, v]) => `# ${k}: ${v}`);
  const head = ["etiqueta", "estimacion", "unidad", "anio", "geo_nivel", "geo_codigo", "geo_nombre", "ic_bajo", "ic_alto", "cv", "precision", "observado_o_modelado", "pagina_fuente"];
  const body = e.rows.map((r) =>
    [r.label, r.estimate, r.unit, r.year, r.geo_level, r.geo_code, r.geo_name, r.ci_low, r.ci_high, r.cv, r.precision_flag, r.observed_or_modeled, r.source_page].map(esc).join(","),
  );
  return "\uFEFF" + [...meta, head.join(","), ...body].join("\n");
}

export function exportCsv(e: EvidencePayload, filters: ExportFilters) {
  downloadBlob(new Blob([evidenceToCsv(e, filters)], { type: "text/csv;charset=utf-8" }), `nexo-${slug(e.title)}.csv`);
}

function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Render the first chart SVG or map canvas inside `root` to a PNG with a caption footer. */
export async function exportPng(root: HTMLElement, e: EvidencePayload, filters: ExportFilters) {
  const canvasEl = root.querySelector("canvas");
  const svg = root.querySelector("svg.recharts-surface") as SVGSVGElement | null;
  let img: CanvasImageSource | null = null;
  let w = 0;
  let h = 0;
  if (canvasEl) {
    img = canvasEl;
    w = canvasEl.clientWidth || canvasEl.width;
    h = canvasEl.clientHeight || canvasEl.height;
  } else if (svg) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    // Resolve CSS variables so the standalone SVG keeps colors.
    let xml = new XMLSerializer().serializeToString(clone);
    xml = xml.replace(/var\((--[a-z0-9-]+)\)/gi, (_m, v: string) => toRgb(cssVar(v, "#555")));
    const im = new Image();
    im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    await im.decode();
    img = im;
  } else {
    // HTML-only visual (bar list): draw rows as simple bars.
    w = 720;
    h = 28 * Math.min(e.rows.length, 20) + 20;
  }
  const scale = 2;
  const footer = 70;
  const c = document.createElement("canvas");
  c.width = Math.max(w, 600) * scale;
  c.height = (h + footer + 36) * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = toRgb(cssVar("--card", "#fff"));
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = toRgb(cssVar("--foreground", "#111"));
  ctx.font = "600 15px Manrope, sans-serif";
  ctx.fillText(e.title, 12, 22);
  if (img) ctx.drawImage(img, 0, 32, w, h);
  else {
    const max = Math.max(...e.rows.map((r) => r.estimate), 1);
    ctx.font = "12px Manrope, sans-serif";
    e.rows.slice(0, 20).forEach((r, i) => {
      const y = 42 + i * 28;
      ctx.fillStyle = toRgb(cssVar("--foreground", "#111"));
      ctx.fillText(`${r.label.slice(0, 60)} — ${formatValue(r.estimate, r.unit)}`, 12, y);
      ctx.fillStyle = toRgb(cssVar("--teal", "#0d9488"));
      ctx.fillRect(12, y + 5, (r.estimate / max) * (w - 40), 6);
    });
  }
  ctx.fillStyle = toRgb(cssVar("--muted-foreground", "#555"));
  ctx.font = "11px Manrope, sans-serif";
  const meta = exportMeta(e, filters);
  meta.slice(1).forEach(([k, v], i) => ctx.fillText(`${k}: ${String(v).slice(0, 140)}`, 12, h + 50 + i * 11));
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
  downloadBlob(blob, `nexo-${slug(e.title)}.png`);
}

function toRgb(color: string) {
  if (!color.startsWith("oklch")) return color;
  const probe = document.createElement("div");
  probe.style.color = color;
  document.body.appendChild(probe);
  const c = document.createElement("canvas").getContext("2d")!;
  c.fillStyle = getComputedStyle(probe).color;
  probe.remove();
  return c.fillStyle;
}

const h = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** Opens a print-friendly brief (Save as PDF from the print dialog). Call synchronously from a click. */
export function printBrief(opts: { title: string; answer?: string; evidence: EvidencePayload[]; filters: ExportFilters; extra?: { heading: string; lines: string[] }[] }) {
  const w = window.open("", "_blank");
  if (!w) return false;
  const sections = opts.evidence
    .map((e) => {
      const rows = e.rows
        .slice(0, 40)
        .map((r) => `<tr><td>${h(r.label)}</td><td class="n">${h(formatValue(r.estimate, r.unit))}</td><td>${h(r.year)}</td><td>${h(OOM_LABEL[r.observed_or_modeled])}</td></tr>`)
        .join("");
      const meta = exportMeta(e, opts.filters)
        .map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`)
        .join("");
      return `<section><h2>${h(e.title)}</h2>${rows ? `<table><thead><tr><th>Etiqueta</th><th>Valor</th><th>Año</th><th>Condición</th></tr></thead><tbody>${rows}</tbody></table>` : "<p><em>Pendiente de carga</em></p>"}<dl>${meta}</dl>${e.warnings.length ? `<ul class="w">${e.warnings.map((x) => `<li>${h(x)}</li>`).join("")}</ul>` : ""}</section>`;
    })
    .join("");
  const extra = (opts.extra ?? []).map((x) => `<section><h2>${h(x.heading)}</h2><ul>${x.lines.map((l) => `<li>${h(l)}</li>`).join("")}</ul></section>`).join("");
  const answer = opts.answer ? `<section><h2>Respuesta</h2><p>${h(opts.answer).replace(/\n/g, "<br>")}</p></section>` : "";
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${h(opts.title)} — NEXO MX 2030</title>
<style>@page{size:A4;margin:14mm}body{font-family:Manrope,system-ui,sans-serif;color:#13213a;font-size:12px;line-height:1.45}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ccd;padding-bottom:3px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3e3ea;padding:3px 4px;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin-top:8px;color:#445}dt{font-weight:700}.w{color:#7a4a00}section{break-inside:avoid}footer{margin-top:20px;color:#667;font-size:10px}</style></head>
<body><h1>${h(opts.title)}</h1><p>Informe analítico · NEXO MX 2030 (observatorio cívico, no es un sitio oficial) · Filtros: ${h(filtersText(opts.filters))} · Generado: ${h(new Date().toLocaleString("es-MX"))}</p>
${answer}${sections}${extra}<footer>Cifras tomadas de fuentes oficiales revisadas. Asociación no implica causalidad. No incluye microdatos ni registros de conversación.</footer>
<script>window.onload=()=>setTimeout(()=>window.print(),200)</script></body></html>`);
  w.document.close();
  return true;
}

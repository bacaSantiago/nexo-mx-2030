import { z } from "zod";
import type { EvidencePayload } from "@/lib/analytics/types";
import { UNMEASURED_ANSWER } from "./intent";
import { formatValue } from "@/lib/format";
import { normalizeText } from "./guard";

export const chatResponseSchema = z.object({
  answer: z.string().min(1).max(3000),
  citations: z.array(z.object({ ref: z.string().regex(/^E\d{1,3}$/), row_id: z.string(), source_code: z.string().nullable() })),
  evidence_ids: z.array(z.string()),
  validated: z.boolean(),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export type MethodNoteLite = { note_code: string; title: string; body: string };

/** Numbered evidence lines given to the model; the only facts it may use. */
export function evidenceLines(e: EvidencePayload | null, max = 24) {
  if (!e) return [] as { ref: string; row_id: string; text: string; source_code: string | null }[];
  const src = e.sources[0];
  return e.rows.slice(0, max).map((r, i) => ({
    ref: `E${i + 1}`,
    row_id: r.id,
    source_code: src?.source_code ?? null,
    text: `${r.label}${r.geo_name && !r.label.includes(r.geo_name) ? ` (${r.geo_name})` : ""}: ${formatValue(r.estimate, r.unit)} · año ${r.year} · ${r.observed_or_modeled}`,
  }));
}

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
export function extractNumbers(s: string): number[] {
  return (s.match(NUM_RE) ?? []).map((x) => Number(x.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
}

const KNOWN_SOURCES = ["endutih", "enigh", "eic", "intercensal", "enoe", "enif", "denue", "cnbv", "ift", "vabcoel", "censos economicos", "mip", "profeco", "antad"];

export type ValidationIssue = { kind: "invented_number" | "bad_citation" | "foreign_source" | "missing_citation" | "no_evidence_numbers"; detail: string };

/** Reject any number or citation not present in the evidence payload. */
export function validateAnswer(answer: string, e: EvidencePayload | null, notes: MethodNoteLite[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = evidenceLines(e);
  const allowedText = [
    ...lines.map((l) => l.text),
    ...(e?.sources.map((s) => `${s.source_name} ${s.year ?? ""} ${s.pages.join(" ")}`) ?? []),
    ...notes.map((n) => `${n.title} ${n.body}`),
    e?.universe ?? "",
    ...(e?.warnings ?? []),
  ].join(" \n ");
  const allowed = new Set<number>(extractNumbers(allowedText));
  for (const r of e?.rows ?? []) {
    allowed.add(r.estimate);
    allowed.add(Math.round(r.estimate * 10) / 10);
    allowed.add(r.year);
  }
  const textNoRefs = answer.replace(/\[E\d+\]/g, "");
  for (const n of extractNumbers(textNoRefs)) {
    if (n <= 10 && Number.isInteger(n)) continue; // ordinals / small counts ("las 3 entidades")
    const ok = [...allowed].some((a) => Math.abs(a - n) < 0.051);
    if (!ok) issues.push({ kind: "invented_number", detail: String(n) });
  }
  const refs = [...answer.matchAll(/\[E(\d+)\]/g)].map((m) => Number(m[1]));
  for (const r of refs) if (r < 1 || r > lines.length) issues.push({ kind: "bad_citation", detail: `E${r}` });
  if (!lines.length && extractNumbers(textNoRefs).some((n) => !(n <= 10 && Number.isInteger(n)) && !allowed.has(n)))
    issues.push({ kind: "no_evidence_numbers", detail: "Cifras sin evidencia" });
  if (lines.length && extractNumbers(textNoRefs).some((n) => n > 10) && refs.length === 0)
    issues.push({ kind: "missing_citation", detail: "Cifras sin cita [E#]" });
  const allowedSources = normalizeText(allowedText + " " + (e?.sources.map((s) => s.source_code).join(" ") ?? ""));
  const norm = normalizeText(answer);
  for (const s of KNOWN_SOURCES) {
    const re = new RegExp(`\\b${s}\\b`);
    if (re.test(norm) && !re.test(allowedSources)) issues.push({ kind: "foreign_source", detail: s });
  }
  return issues;
}

export function buildCitations(answer: string, e: EvidencePayload | null) {
  const lines = evidenceLines(e);
  const refs = [...new Set([...answer.matchAll(/\[E(\d+)\]/g)].map((m) => Number(m[1])))];
  return refs
    .map((r) => lines[r - 1])
    .filter((l): l is NonNullable<typeof l> => !!l)
    .map((l) => ({ ref: l.ref, row_id: l.row_id, source_code: l.source_code }));
}

/** Fully deterministic fallback grounded only in the payload. */
export function deterministicAnswer(e: EvidencePayload | null, missing?: string): string {
  if (missing === "unmeasured") return UNMEASURED_ANSWER;
  if (!e || !e.rows.length) {
    return missing
      ? `No hay datos cargados para responder: falta ${missing}. No estimo ni completo cifras ausentes.`
      : "Pendiente de carga: no hay estimaciones revisadas para esta consulta. No estimo ni completo cifras ausentes.";
  }
  const lines = evidenceLines(e, 4);
  const src = e.sources.map((s) => s.source_name).join(", ") || "fuente oficial";
  const items = lines.map((l) => `- ${l.text.split(" · ")[0]} [${l.ref}]`).join("\n");
  const warn = e.warnings[0] ? `\n\n${e.warnings[0]}` : "";
  return `**${e.title}** (${src}, ${e.years.join(", ")}):\n${items}\n\nUniverso: ${e.universe ?? "pendiente"}. Es una lectura descriptiva; no implica causalidad.${warn}`;
}

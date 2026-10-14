import { z } from "zod";

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_BODY_BYTES = 8 * 1024;

export const chatFiltersSchema = z
  .object({
    year: z.number().int().min(1990).max(2100).nullable().optional(),
    geo_code: z.string().regex(/^\d{2}$/).nullable().optional(),
    area: z.string().max(40).nullable().optional(),
    sex: z.string().max(40).nullable().optional(),
    age_group: z.string().max(40).nullable().optional(),
  })
  .strip();

export const chatRequestSchema = z.object({
  message: z.string().trim().min(2).max(MAX_MESSAGE_CHARS),
  filters: chatFiltersSchema.default({}),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const sessionTokenSchema = z.string().regex(/^[A-Za-z0-9-]{32,64}$/);

const SQL_PATTERNS = [
  /\b(select|insert|update|delete|drop|alter|truncate|grant|revoke|create)\b[\s\S]{0,40}\b(from|into|table|set|database|schema|on|role)\b/i,
  /;\s*--/,
  /\bunion\s+(all\s+)?select\b/i,
  /\b(pg_|information_schema|auth\.users|service_role)\b/i,
  /'\s*or\s*'?\d*'?\s*=\s*'?\d*/i,
];

const INJECTION_PATTERNS = [
  /ignora(r)?\s+(las|todas|tus|las\s+anteriores)?\s*(instrucciones|reglas)/i,
  /ignore\s+(all\s+|the\s+|your\s+)?(previous|prior|above)?\s*(instructions|rules|prompt)/i,
  /(system|developer)\s*prompt/i,
  /(revela|muestra|imprime|dime)\s+(tu|el|tus)\s+(prompt|instrucciones|sistema)/i,
  /act[uú]a\s+como|pretend\s+(to\s+be|you\s+are)|jailbreak|\bDAN\b/i,
  /<\/?(script|system|instructions?)>/i,
];

export type GuardResult = { ok: true; text: string } | { ok: false; reason: "sql" | "injection" | "empty"; message: string };

/** Normalize and screen a user message before any processing. */
export function screenMessage(raw: string): GuardResult {
  // eslint-disable-next-line no-control-regex
  const text = raw.normalize("NFKC").replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u2028-\u202E]/g, "").trim();
  if (text.length < 2) return { ok: false, reason: "empty", message: "Escribe una pregunta un poco más completa." };
  if (SQL_PATTERNS.some((p) => p.test(text)))
    return {
      ok: false,
      reason: "sql",
      message: "No ejecuto consultas SQL ni accedo directamente a la base de datos. Pregunta en lenguaje natural sobre las cifras disponibles.",
    };
  if (INJECTION_PATTERNS.some((p) => p.test(text)))
    return {
      ok: false,
      reason: "injection",
      message: "No puedo cambiar mis reglas ni mostrar instrucciones internas. Puedo responder preguntas sobre las cifras oficiales revisadas.",
    };
  return { ok: true, text };
}

/** Strip HTML, images, links and code fences from model output; keep plain text with **bold** and lists. */
export function sanitizeMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, "$1")
    .replace(/\bhttps?:\/\/\S+/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();
}

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

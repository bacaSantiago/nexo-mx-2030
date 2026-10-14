import type { EvidencePayload } from "@/lib/analytics/types";

export type ChatEvent =
  | { type: "meta"; intent: string; params: Record<string, unknown>; evidence: EvidencePayload | null; notes: { note_code: string; title: string }[] }
  | { type: "delta"; text: string }
  | { type: "replace"; reason: string }
  | { type: "notice"; message: string }
  | { type: "final"; answer: string; citations: { ref: string; row_id: string; source_code: string | null }[]; evidence_ids: string[]; validated: boolean; latency_ms: number }
  | { type: "error"; message: string };

const KEY = "nexo-session-token";
export function sessionToken() {
  let t = localStorage.getItem(KEY);
  if (!t || !/^[A-Za-z0-9-]{32,64}$/.test(t)) {
    t = crypto.randomUUID();
    localStorage.setItem(KEY, t);
  }
  return t;
}

export async function streamNexoChat(
  body: { message: string; filters: Record<string, unknown> },
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/public/nexo-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-token": sessionToken() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = "No pudimos completar la respuesta. Intenta de nuevo.";
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      /* keep default */
    }
    onEvent({ type: "error", message: msg });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line) as ChatEvent);
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as ChatEvent);
}

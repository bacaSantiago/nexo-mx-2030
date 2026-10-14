import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, BarChart3, FileSearch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EvidencePayload } from "@/lib/analytics/types";
import { formatValue } from "@/lib/format";
import { PrecisionBadge, ObservedBadge } from "./badges";

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: EvidencePayload;
  status?: "loading" | "error" | "done";
};

export type Suggestion = { id: string; text: string; tag: string };

export function PromptSuggestions({ items, onPick }: { items: Suggestion[]; onPick: (s: Suggestion) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s)}
          className="group flex min-w-0 flex-col items-start gap-1.5 rounded-lg border bg-card p-3.5 text-left transition-colors hover:border-teal/50 hover:bg-teal-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">{s.tag}</span>
          <span className="text-sm font-medium leading-snug">{s.text}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatMessage({ msg, onShowEvidence }: { msg: ChatMsg; onShowEvidence?: (e: EvidencePayload) => void }) {
  if (msg.role === "user")
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">{msg.content}</p>
      </div>
    );
  const e = msg.evidence;
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-teal text-xs font-extrabold text-teal-foreground" aria-hidden>
        N
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {msg.status === "loading" ? (
          <p className="animate-pulse text-sm text-muted-foreground" role="status">
            Consultando datos revisados…
          </p>
        ) : (
          <p className={cn("text-sm leading-relaxed", msg.status === "error" && "text-destructive")}>{msg.content}</p>
        )}
        {e && e.rows.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {e.rows.slice(0, 3).map((r) => (
                <div key={r.id} className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground" title={r.label}>
                    {r.label}
                  </p>
                  <p className="tabular text-lg font-bold">{formatValue(r.estimate, r.unit)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {e.uncertainty.precision_flags.map((f) => (
                <PrecisionBadge key={f} flag={f} />
              ))}
              {e.observed_or_modeled.map((o) => (
                <ObservedBadge key={o} value={o} />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {e.sources.map((s) => s.source_name).join(", ")} · {e.universe}
            </p>
            {onShowEvidence && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => onShowEvidence(e)}>
                <FileSearch aria-hidden /> Ver evidencia
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatComposer({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = (ev?: FormEvent) => {
    ev?.preventDefault();
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t.slice(0, 1000));
    setValue("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  return (
    <form onSubmit={submit} className="border-t bg-background/95 px-3 pb-3 pt-2 sm:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-teal/60">
        <label htmlFor="composer" className="sr-only">
          Escribe tu pregunta
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          maxLength={1000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder="Pregunta sobre adopción, barreras o brechas del comercio digital…"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" disabled={disabled || !value.trim()} aria-label="Enviar pregunta" className="shrink-0 rounded-lg">
          <ArrowUp />
        </Button>
      </div>
      <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted-foreground">
        Las cifras provienen solo de datos oficiales revisados. Asociación no implica causalidad.
      </p>
    </form>
  );
}

export function ChatThread({
  messages,
  suggestions,
  onPick,
  onShowEvidence,
}: {
  messages: ChatMsg[];
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
  onShowEvidence: (e: EvidencePayload) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);
  if (!messages.length)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-1 text-xs font-semibold text-accent-foreground">
          <Sparkles className="size-3.5" aria-hidden /> Observatorio conversacional
        </div>
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Del acceso a la compra: quién queda fuera, por qué y qué intervención funciona.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Pregunta sobre la adopción del comercio electrónico en México. Cada respuesta muestra la cifra oficial, su fuente,
          universo, método e incertidumbre.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <BarChart3 className="size-4" aria-hidden /> Preguntas sugeridas
        </div>
        <div className="mt-3">
          <PromptSuggestions items={suggestions} onPick={onPick} />
        </div>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6" aria-live="polite">
      {messages.map((m) => (
        <ChatMessage key={m.id} msg={m} onShowEvidence={onShowEvidence} />
      ))}
      <div ref={end} />
    </div>
  );
}

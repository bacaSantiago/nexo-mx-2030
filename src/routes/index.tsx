import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { AppShell } from "@/components/nexo/AppShell";
import { ChatComposer, ChatThread, type ChatMsg, type Suggestion } from "@/components/nexo/chat";
import { EvidenceCanvas, type CanvasState } from "@/components/nexo/EvidenceCanvas";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { EvidencePayload } from "@/lib/analytics/types";
import { streamNexoChat } from "@/lib/chat/client";
import { useGlobalFilters } from "@/components/nexo/filters-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXO MX 2030 — Observatorio conversacional de comercio digital" },
      {
        name: "description",
        content: "Pregunta quién queda fuera del comercio electrónico en México, por qué y qué intervención funciona, con cifras oficiales y su método.",
      },
      { property: "og:title", content: "NEXO MX 2030 — Observatorio conversacional" },
      { property: "og:description", content: "Del acceso a la compra: cifras oficiales con fuente, universo e incertidumbre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatWorkspace,
});

const SUGGESTIONS: Suggestion[] = [
  { id: "purchase", tag: "Adopción", text: "¿Qué porcentaje de las personas usuarias de internet compra en línea?" },
  { id: "urban_rural", tag: "Brecha territorial", text: "¿Cuál es la brecha urbano-rural en compras por internet?" },
  { id: "barriers", tag: "Barreras", text: "¿Por qué las personas usuarias no compran por internet?" },
  { id: "categories", tag: "Canasta digital", text: "¿Qué categorías se compran más por internet?" },
  { id: "states", tag: "Territorio", text: "¿Qué entidades tienen menor uso de internet?" },
  { id: "age", tag: "Generaciones", text: "¿Cómo cambia el uso de internet por grupo de edad?" },
];

function useBelowLg() {
  const [v, setV] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setV(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

function ChatWorkspace() {
  const { filters } = useGlobalFilters();
  const isMobile = useBelowLg();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [canvas, setCanvas] = useState<CanvasState>({ status: "idle" });
  const [canvasOpen, setCanvasOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const busy = messages.some((m) => m.status === "loading");

  const showEvidence = (e: EvidencePayload) => {
    setCanvas({ status: "ready", evidence: e });
    if (isMobile) setSheetOpen(true);
    else setCanvasOpen(true);
  };

  const abortRef = useRef<AbortController | null>(null);
  const patch = (id: string, f: (m: ChatMsg) => ChatMsg) => setMessages((m) => m.map((x) => (x.id === id ? f(x) : x)));

  const ask = async (text: string) => {
    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();
    setMessages((m) => [...m, { id: uid, role: "user", content: text }, { id: aid, role: "assistant", content: "", status: "loading" }]);
    setCanvas({ status: "loading" });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamNexoChat(
        { message: text, filters: { year: filters.year, geo_code: filters.geo_code, area: filters.area, sex: filters.sex, age_group: filters.age_group } },
        (ev) => {
          if (ev.type === "meta") {
            patch(aid, (x) => ({ ...x, evidence: ev.evidence }));
            if (ev.evidence) showEvidence(ev.evidence);
            else setCanvas({ status: "idle" });
          } else if (ev.type === "delta") patch(aid, (x) => ({ ...x, content: x.content + ev.text }));
          else if (ev.type === "replace" || ev.type === "notice")
            patch(aid, (x) => ({ ...x, notice: ev.type === "replace" ? ev.reason : ev.message }));
          else if (ev.type === "final")
            patch(aid, (x) => ({ ...x, status: "done", content: ev.answer, validated: ev.validated, citations: ev.citations }));
          else if (ev.type === "error") {
            patch(aid, (x) => ({ ...x, status: "error", content: ev.message }));
            setCanvas({ status: "error", message: ev.message, retry: () => ask(text) });
          }
        },
        ctrl.signal,
      );
      patch(aid, (x) => (x.status === "loading" ? { ...x, status: x.content ? "done" : "error", content: x.content || "La respuesta se interrumpió." } : x));
    } catch (err) {
      const stopped = (err as Error)?.name === "AbortError";
      patch(aid, (x) => ({ ...x, status: stopped ? "done" : "error", content: x.content || (stopped ? "Respuesta detenida." : "No pudimos conectar con el servidor. Intenta de nuevo."), notice: stopped ? "Detenida por ti" : x.notice }));
      if (!stopped) setCanvas({ status: "error", message: "No pudimos consultar los datos.", retry: () => ask(text) });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <AppShell
      toolbar={
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          onClick={() => setCanvasOpen((o) => !o)}
          aria-label={canvasOpen ? "Ocultar evidencia" : "Mostrar evidencia"}
        >
          {canvasOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      }
    >
      <div className="flex h-full min-h-0">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatThread
              messages={messages}
              suggestions={SUGGESTIONS}
              onPick={(s) => ask(s.text)}
              onShowEvidence={showEvidence}
            />
          </div>
          <ChatComposer onSend={(t) => ask(t)} disabled={busy} onStop={busy ? () => abortRef.current?.abort() : undefined} />
        </main>
        {canvasOpen && (
          <aside className="hidden w-[380px] shrink-0 border-l bg-card/50 lg:block xl:w-[420px]" aria-label="Evidencia">
            <EvidenceCanvas state={canvas} onClose={() => setCanvasOpen(false)} />
          </aside>
        )}
      </div>
      <Drawer open={sheetOpen && isMobile} onOpenChange={setSheetOpen}>
        <DrawerContent className="h-[85dvh]">
          <DrawerTitle className="sr-only">Evidencia</DrawerTitle>
          <EvidenceCanvas state={canvas} />
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

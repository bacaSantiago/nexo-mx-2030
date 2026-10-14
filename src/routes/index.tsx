import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { AppShell } from "@/components/nexo/AppShell";
import { ChatComposer, ChatThread, type ChatMsg, type Suggestion } from "@/components/nexo/chat";
import { EvidenceCanvas, type CanvasState } from "@/components/nexo/EvidenceCanvas";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { EvidencePayload } from "@/lib/analytics/types";
import { barriersQuery, categoriesQuery, rankQuery, segmentsQuery } from "@/lib/queries";
import { getScenario } from "@/lib/analytics.functions";
import { compareSegments } from "@/lib/analytics.functions";
import { formatValue } from "@/lib/format";

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

function answerFor(id: string, e: EvidencePayload): string {
  const src = e.sources[0]?.source_name ?? "fuente oficial";
  const r = e.rows;
  if (!r.length) return "Pendiente de carga: aún no hay estimaciones revisadas para responder esta pregunta.";
  const fv = (x: (typeof r)[number]) => formatValue(x.estimate, x.unit);
  switch (id) {
    case "purchase": {
      const p = r.find((x) => x.label.startsWith("Comprar"));
      return p
        ? `Según ${src} (${p.year}), ${fv(p)} de las personas usuarias de internet lo usó para comprar productos o servicios. Es una cifra sobre personas usuarias, no sobre toda la población.`
        : "Pendiente de carga.";
    }
    case "urban_rural": {
      const u = r.find((x) => x.label === "Urbano");
      const ru = r.find((x) => x.label === "Rural");
      return u && ru
        ? `En ${u.year}, ${fv(u)} de las personas usuarias urbanas compró por internet frente a ${fv(ru)} en el ámbito rural (${src}). La diferencia es descriptiva y su precisión está pendiente de recalcular.`
        : "Pendiente de carga.";
    }
    case "barriers":
      return `La razón más reportada es “${r[0].label}” (${fv(r[0])}), seguida de “${r[1]?.label}” (${r[1] ? fv(r[1]) : "—"}). Es respuesta múltiple: los porcentajes no se suman (${src}).`;
    case "categories":
      return `Entre quienes compraron por internet, la categoría más frecuente fue “${r[0].label}” (${fv(r[0])}), seguida de “${r[1]?.label}” (${r[1] ? fv(r[1]) : "—"}). Respuesta múltiple (${src}).`;
    case "states": {
      const low = [...r].sort((a, b) => a.estimate - b.estimate).slice(0, 3);
      return `Las entidades con menor porcentaje de personas usuarias de internet en ${low[0].year} son ${low.map((x) => `${x.geo_name} (${fv(x)})`).join(", ")}. Diferencias pequeñas pueden no ser significativas.`;
    }
    case "age": {
      const sorted = [...r].sort((a, b) => b.estimate - a.estimate);
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      return `En ${hi.year}, el uso de internet va de ${fv(hi)} en ${hi.label} a ${fv(lo)} en ${lo.label} (${src}).`;
    }
  }
  return "";
}

function ChatWorkspace() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
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

  const fetchFor = (id: string): Promise<EvidencePayload> => {
    switch (id) {
      case "purchase":
        return qc.fetchQuery(segmentsQuery("internet_use_type_pct", "use_type", 2025));
      case "urban_rural":
        return qc.fetchQuery({
          queryKey: ["segments-within", "purchase-area"],
          queryFn: () =>
            compareSegments({
              data: { metric_code: "internet_use_type_pct", dimension: "area", year: 2025, within: { use_type: "Comprar productos o servicios" } },
            }),
        });
      case "barriers":
        return qc.fetchQuery(barriersQuery(2025));
      case "categories":
        return qc.fetchQuery(categoriesQuery(2025));
      case "states":
        return qc.fetchQuery(rankQuery("internet_users_pct", 2025));
      case "age":
        return qc.fetchQuery(segmentsQuery("internet_users_pct", "age_group", 2025));
    }
    return getScenario({ data: {} }).then((s) => s.evidence);
  };

  const ask = async (text: string, suggestionId?: string) => {
    const uid = crypto.randomUUID();
    const aid = crypto.randomUUID();
    setMessages((m) => [...m, { id: uid, role: "user", content: text }, { id: aid, role: "assistant", content: "", status: "loading" }]);
    if (!suggestionId) {
      setMessages((m) =>
        m.map((x) =>
          x.id === aid
            ? {
                ...x,
                status: "done",
                content:
                  "El asistente conversacional aún no está activo. Por ahora puedes elegir una de las preguntas sugeridas o explorar las vistas analíticas del menú.",
              }
            : x,
        ),
      );
      return;
    }
    setCanvas({ status: "loading" });
    try {
      const e = await fetchFor(suggestionId);
      setMessages((m) => m.map((x) => (x.id === aid ? { ...x, status: "done", content: answerFor(suggestionId, e), evidence: e } : x)));
      showEvidence(e);
    } catch {
      setMessages((m) =>
        m.map((x) => (x.id === aid ? { ...x, status: "error", content: "No pudimos consultar los datos. Intenta de nuevo." } : x)),
      );
      setCanvas({ status: "error", message: "No pudimos consultar los datos.", retry: () => ask(text, suggestionId) });
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
              onPick={(s) => ask(s.text, s.id)}
              onShowEvidence={showEvidence}
            />
          </div>
          <ChatComposer onSend={(t) => ask(t, SUGGESTIONS.find((s) => s.text === t)?.id)} disabled={busy} />
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

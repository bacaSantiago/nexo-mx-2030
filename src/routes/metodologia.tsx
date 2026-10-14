import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { AppShell, PageScroll } from "@/components/nexo/AppShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { ObservedBadge } from "@/components/nexo/badges";
import { headFor, RouteError, RouteNotFound, RoutePending } from "@/components/nexo/route-helpers";
import { methodologyQuery } from "@/lib/queries";

export const Route = createFileRoute("/metodologia")({
  head: () => headFor("Metodología", "Cómo NEXO calcula y presenta cifras: diseño muestral, intervalos, CV, modelos logísticos, Fairlie, emparejamiento, MRP, análisis espacial y escenarios."),
  loader: ({ context }) => context.queryClient.ensureQueryData(methodologyQuery()),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: Metodologia,
});

const METHODS: { id: string; title: string; kind: "observed" | "modeled" | "imputed" | "scenario"; plain: string; technical: string }[] = [
  { id: "weights", title: "Estimaciones ponderadas por encuesta", kind: "observed", plain: "Cada persona entrevistada representa a muchas otras. Usamos los factores de expansión oficiales para que la cifra represente a toda la población.", technical: "Estimadores de Horvitz-Thompson / razón con el factor de expansión publicado (p. ej. FAC_PER, FAC_HOG). Totales y proporciones se calculan sobre el universo declarado; nunca se combinan universos." },
  { id: "design", title: "Diseño muestral complejo", kind: "observed", plain: "Las encuestas no son muestras al azar simples: se eligen zonas y luego viviendas. Ignorarlo hace que los márgenes de error parezcan más pequeños de lo que son.", technical: "Varianza por linealización de Taylor con estrato (EST_DIS) y unidad primaria de muestreo (UPM), equivalente a survey::svydesign(ids=~UPM, strata=~EST_DIS, weights=~FAC). Estratos con una sola UPM: ajuste 'adjust'." },
  { id: "ci", title: "Intervalos de confianza", kind: "observed", plain: "Un rango donde, con alta probabilidad, está el valor real. Si dos rangos se traslapan mucho, la diferencia puede no ser real.", technical: "IC al 90 % (convención INEGI) o 95 %, con nivel declarado en cada cifra; para proporciones cercanas a 0 o 1 se usa transformación logit." },
  { id: "cv", title: "Coeficiente de variación (CV)", kind: "observed", plain: "Mide qué tan estable es una cifra. Mientras más alto, menos confiable.", technical: "CV = EE / estimación. Clasificación INEGI: alta < 15 %, moderada 15–30 %, baja > 30 %. Cifras de baja precisión se muestran con advertencia; no se ocultan ni se 'corrigen'." },
  { id: "logit", title: "Modelos logísticos", kind: "modeled", plain: "Permiten ver qué características se asocian con comprar en línea, manteniendo lo demás constante.", technical: "Regresión logística ponderada (svyglm, family=quasibinomial) con edad, sexo, ámbito, escolaridad, conectividad y medios de pago. Coeficientes descriptivos; no causales." },
  { id: "ame", title: "Efectos marginales promedio", kind: "modeled", plain: "Traducen el modelo a puntos porcentuales: 'en promedio, tener X se asocia con Y puntos más de compra'.", technical: "AME = promedio ponderado de ∂P/∂x (o diferencias discretas para variables binarias), con EE por método delta o replicación." },
  { id: "fairlie", title: "Descomposición de Fairlie", kind: "modeled", plain: "Separa qué parte de una brecha (p. ej. urbano-rural) se asocia a diferencias en características y qué parte queda sin explicar.", technical: "Extensión no lineal de Oaxaca-Blinder para resultados binarios; orden de variables aleatorizado y promediado. La parte 'no explicada' no equivale a discriminación ni a causa." },
  { id: "match", title: "Emparejamiento estadístico", kind: "imputed", plain: "La ENDUTIH no mide ingreso con detalle; lo 'tomamos prestado' de ENIGH emparejando hogares parecidos. Por eso se etiqueta como ingreso imputado.", technical: "Cada persona de ENDUTIH recibe la distribución de deciles de su celda ENIGH (entidad, tamaño de localidad, sexo, edad y escolaridad agrupada). El error estándar publicado es el de muestreo de ENDUTIH condicionado a esa distribución. No incluye la varianza del emparejamiento: el bootstrap de esa varianza está pendiente. Por eso la precisión del ingreso imputado no se marca alta." },
  { id: "mrp", title: "MRP (estimación modelada municipal)", kind: "modeled", plain: "Las encuestas no alcanzan para cada municipio. MRP combina un modelo con la composición de población del municipio para dar una estimación modelada.", technical: "Regresión multinivel con efectos por entidad/municipio y postestratificación con conteos EIC. Se publica con intervalos posteriores; siempre como 'Estimación modelada', nunca como dato observado." },
  { id: "spatial", title: "Análisis espacial", kind: "modeled", plain: "Busca zonas donde la demanda potencial es alta y la oferta formal es baja.", technical: "Índices compuestos normalizados, autocorrelación espacial (Moran local) y cuadrantes demanda/oferta. Usa el Marco Geoestadístico oficial." },
  { id: "scen", title: "Modelación de escenarios", kind: "scenario", plain: "Explora qué podría pasar a 2030 bajo supuestos explícitos. No es un pronóstico oficial.", technical: "Difusión logística o Gompertz jerárquica con series 2015–2025 y covariables; resultados precalculados por malla de supuestos (p10–p90). La web solo lee la malla; interpola linealmente sin extrapolar." },
];

const WARNINGS = [
  "Uniones entre encuestas: ENDUTIH, ENIGH, ENOE y EIC no comparten personas; no se unen registros. Solo se combinan mediante emparejamiento estadístico o postestratificación, y se declara.",
  "Universos estrictos: persona en ENDUTIH, vivienda en EIC, hogar en ENIGH y establecimiento en Censos Económicos o DENUE. Una cifra de un universo no se lee como si fuera de otro.",
  "Varianza del emparejamiento ENDUTIH–ENIGH: el error estándar publicado es el de muestreo de ENDUTIH condicionado a la distribución de la celda ENIGH. Todavía no incluye el error estándar del modelo de imputación. El bootstrap de esa varianza está pendiente, y por eso la precisión del ingreso imputado no se marca alta.",
  "Geometría municipal de la EIC: la capa de puntos anterior no traía coordenadas para nueve municipios (02007 San Felipe, 04013 Dzitbalché, 12082 Las Vigas, 12083 Ñuu Savi, 12084 Santa Cruz del Rincón, 12085 San Nicolás, 24059 Villa de Pozos, 25019 Eldorado y 25020 Juan José Ríos). El coropleta usa los polígonos del Marco Geoestadístico integrado 2025, que sí los incluye. Si la base no tiene una cifra revisada para esa clave, el municipio no se colorea.",
  "Imputaciones: todo resultado que use ingreso o decil proveniente de ENIGH se etiqueta 'Ingreso imputado'.",
  "Estimaciones municipales: son modeladas (MRP) y tienen mayor incertidumbre; no sustituyen un dato observado.",
  "VAB vs. ventas: el valor agregado bruto del comercio electrónico (VABCOEL) no equivale a ventas ni a gasto de los hogares.",
  "Asociación no implica causalidad: ningún resultado se interpreta como efecto causal sin un diseño experimental o cuasi-experimental.",
];

const GLOSSARY: [string, string][] = [
  ["Universo", "Población a la que se refiere una cifra (personas, hogares, viviendas o establecimientos)."],
  ["Factor de expansión", "Peso que indica a cuántas unidades de la población representa cada caso de la muestra."],
  ["UPM", "Unidad primaria de muestreo: el área seleccionada en la primera etapa del muestreo."],
  ["Estrato", "Grupo de UPM similares dentro del cual se selecciona la muestra."],
  ["Error estándar (EE)", "Medida de la variabilidad de una estimación por efecto del muestreo."],
  ["Intervalo de confianza", "Rango de valores plausibles para el parámetro poblacional."],
  ["CV", "Coeficiente de variación: EE dividido entre la estimación."],
  ["Dato observado", "Cifra calculada directamente de una encuesta o registro oficial."],
  ["Estimación modelada", "Cifra producida por un modelo estadístico (p. ej. MRP)."],
  ["Ingreso imputado", "Ingreso asignado por emparejamiento con ENIGH, no medido en la encuesta original."],
  ["Escenario", "Resultado bajo supuestos explícitos; no es pronóstico."],
  ["Respuesta múltiple", "Pregunta donde se pueden elegir varias opciones; los porcentajes no suman 100."],
  ["p10–p90", "Rango que contiene el 80 % central de los resultados simulados."],
  ["VAB", "Valor agregado bruto: producción menos consumo intermedio."],
];

function Metodologia() {
  const { data } = useSuspenseQuery(methodologyQuery());
  const [q, setQ] = useState("");
  const g = GLOSSARY.filter(([t, d]) => !q || `${t} ${d}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <AppShell>
      <PageScroll title="Metodología" description="Qué es un dato observado, una estimación modelada o un ingreso imputado, y cómo se calcula cada uno.">
        <section className="rounded-lg border border-warning/40 bg-warning-soft p-4" aria-label="Advertencias">
          <h2 className="flex items-center gap-2 font-semibold text-warning-foreground"><AlertTriangle className="size-4" aria-hidden /> Advertencias explícitas</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-foreground">{WARNINGS.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>

        <h2 className="mt-8 text-lg font-bold">Métodos</h2>
        <p className="text-sm text-muted-foreground">Cada sección tiene una explicación sencilla y un detalle técnico.</p>
        <Accordion type="multiple" className="mt-3 rounded-lg border bg-card px-4">
          {METHODS.map((m) => (
            <AccordionItem key={m.id} value={m.id}>
              <AccordionTrigger className="text-left">
                <span className="flex flex-wrap items-center gap-2">{m.title} <ObservedBadge value={m.kind} /></span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-sm">{m.plain}</p>
                <div className="rounded-md bg-muted p-3 text-xs leading-relaxed"><span className="font-semibold">Detalle técnico. </span>{m.technical}</div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {data.notes.length > 0 && (
          <>
            <h2 className="mt-8 text-lg font-bold">Notas de las fuentes cargadas</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.notes.map((n) => (
                <article key={n.note_code} className="rounded-lg border bg-card p-4">
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  {n.source_name && <p className="mt-2 text-xs">Fuente: {n.source_name}</p>}
                </article>
              ))}
            </div>
          </>
        )}

        <h2 className="mt-8 text-lg font-bold">Glosario</h2>
        <div className="relative mt-2 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar término…" className="pl-9" aria-label="Buscar en el glosario" />
        </div>
        <dl className="mt-3 grid gap-x-6 gap-y-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          {g.map(([t, d]) => (
            <div key={t}><dt className="text-sm font-semibold">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>
          ))}
        </dl>
      </PageScroll>
    </AppShell>
  );
}

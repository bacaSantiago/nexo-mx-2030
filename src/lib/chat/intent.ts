import { normalizeText } from "./guard";

export type IntentName =
  | "get_metric"
  | "compare_segments"
  | "rank_geographies"
  | "get_barriers"
  | "get_categories"
  | "get_problems"
  | "get_scenario"
  | "get_interventions"
  | "methodology_lookup"
  | "source_lookup"
  | "unsupported";

export type IntentParams = {
  metric_code?: string;
  year?: number;
  geo_code?: string;
  dimension?: "sex" | "area" | "age_group" | "use_type" | "schooling" | "income_decile";
  within?: Record<string, string>;
  order?: "asc" | "desc";
  topic?: string;
  missing?: string;
};

export type Intent = { intent: IntentName; params: IntentParams };

/** Metrics/segments users ask about that are NOT loaded yet; we say exactly what is missing. */
const UNSUPPORTED: { re: RegExp; missing: string }[] = [
  { re: /municipi|alcaldi/, missing: "estimaciones municipales (requieren el modelo MRP revisado)" },
  { re: /escolaridad|educaci[o]n|estudios/, missing: "cortes por escolaridad (requieren microdatos ENDUTIH)" },
  { re: /ingreso|decil|pobre|salari/, missing: "cortes por ingreso o decil imputado (requieren el emparejamiento ENIGH revisado)" },
  { re: /desemple|informalidad|empleo/, missing: "indicadores laborales ENOE (no cargados)" },
  { re: /fraude|queja|devoluci|problema/, missing: "problemas reportados al comprar en línea (pendientes de carga)" },
  { re: /tarjeta|cuenta banc|inclusion financ|credito/, missing: "indicadores de inclusión financiera ENIF/CNBV (no cargados)" },
  { re: /denue|establecimiento|tiendas|oferta formal/, missing: "oferta minorista formal DENUE/Censos Económicos (no cargada)" },
  { re: /gasto|ticket|cuanto gastan|monto/, missing: "gasto en compras en línea (no publicado en el agregado cargado)" },
];

export function classifyIntent(raw: string, geos: { geo_code: string; geo_name: string }[] = []): Intent {
  const t = normalizeText(raw);
  const yearMatch = t.match(/\b(20[12]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : undefined;
  const base: IntentParams = year ? { year } : {};
  const geo = geos.find((g) => g.geo_code !== "00" && t.includes(normalizeText(g.geo_name)));

  const households = /hogar|vivienda/.test(t);
  const purchase = /compr|comercio electronico|e-?commerce|en linea|online/.test(t);
  const usersMetric = households ? "households_with_internet_pct" : "internet_users_pct";

  if (/metodolog|como se calcul|mrp|intervalo|error estandar|coeficiente de variacion|\bcv\b|precision|universo|causal/.test(t))
    return { intent: "methodology_lookup", params: { ...base, topic: t.includes("mrp") ? "mrp" : t.includes("universo") ? "universe" : "precision" } };
  if (/fuente|de donde|endutih|enigh|inegi|vabcoel|citas?/.test(t) && !/cuant|porcentaje|%/.test(t))
    return { intent: "source_lookup", params: base };
  if (/escenario|2030|proyecci|futuro/.test(t)) return { intent: "get_scenario", params: base };
  if (/intervenci|accion|politica|que hacer|puentes|programa/.test(t)) return { intent: "get_interventions", params: base };

  for (const u of UNSUPPORTED) if (u.re.test(t)) return { intent: "unsupported", params: { ...base, missing: u.missing } };

  if (/por que no|razon|barrera|motivo|no compra/.test(t)) return { intent: "get_barriers", params: base };
  if (/categori|que compran|productos|que se compra/.test(t)) return { intent: "get_categories", params: base };
  if (/valor agregado|vab|pib|economia digital/.test(t))
    return { intent: "get_metric", params: { ...base, metric_code: /pib|particip/.test(t) ? "vabcoel_gdp_share_pct" : "vabcoel_current_prices_mxn_millions" } };

  const dim: IntentParams["dimension"] | undefined = /ingreso|decil/.test(t)
    ? "income_decile"
    : /escolar|estudios|nivel educativo/.test(t)
      ? "schooling"
      : /urbano|rural|ambito|brecha territorial/.test(t)
        ? "area"
        : /mujer|hombre|sexo|genero/.test(t)
          ? "sex"
          : /edad|joven|mayor|generaci/.test(t)
            ? "age_group"
            : undefined;

  if (/entidad|estado|ranking|menor|mayor|donde/.test(t) && !geo && !dim)
    return { intent: "rank_geographies", params: { ...base, metric_code: usersMetric, order: /menor|bajo|rezag/.test(t) ? "asc" : "desc" } };

  if (dim) {
    if (purchase && !households)
      return { intent: "compare_segments", params: { ...base, metric_code: "internet_use_type_pct", dimension: dim, within: { use_type: "Comprar productos o servicios" } } };
    return { intent: "compare_segments", params: { ...base, metric_code: usersMetric, dimension: dim } };
  }
  if (purchase && !households) return { intent: "compare_segments", params: { ...base, metric_code: "internet_use_type_pct", dimension: "use_type" } };
  if (/internet|conect|usuari/.test(t))
    return { intent: "get_metric", params: { ...base, metric_code: usersMetric, ...(geo ? { geo_code: geo.geo_code } : {}) } };

  return { intent: "unsupported", params: { ...base, missing: "una métrica reconocible entre las cargadas (uso de internet, compra en línea, barreras, categorías, VAB del comercio electrónico)" } };
}

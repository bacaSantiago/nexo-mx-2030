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

/** Exact sentence when the question asks for a universe the official sources do not measure. */
export const UNMEASURED_ANSWER = "Dato no disponible en fuentes oficiales; universo no medido";

const OUTSIDE_UNIVERSE = /cripto|bitcoin|criptomoneda|\bnft\b|stablecoin|metaverso/;
const BRACKET_STARTS = new Set([6, 15, 25, 35, 45, 55, 65, 75]);

/** A single year of age, or a payment rail the surveys do not measure, is not a published cross. */
export function isUnmeasuredUniverse(text: string) {
  if (OUTSIDE_UNIVERSE.test(text)) return true;
  const match = text.match(/\bde\s+(\d{1,3})\s+anos\b/);
  if (!match) return false;
  const age = Number(match[1]);
  if (!BRACKET_STARTS.has(age)) return true;
  if (age === 75 && /75\s+anos\s+y\s+mas/.test(text)) return false;
  if (new RegExp(`\\b${age}\\s+a\\s+\\d{1,3}\\s+anos\\b`).test(text)) return false;
  return true;
}

/** Topics that are still absent. Loaded series (ingreso, escolaridad, ENOE, ENIF, DENUE) are not listed here. */
const UNSUPPORTED: { re: RegExp; missing: string }[] = [
  { re: /municipi|alcaldi/, missing: "una tasa de personas por municipio (el mapa muestra viviendas con internet, no personas)" },
  { re: /informalidad/, missing: "informalidad laboral (ENOE cargada es la tasa de desocupación, no la informalidad)" },
  { re: /fraude|devoluci|problema al comprar|problemas al comprar/, missing: "problemas reportados al comprar en línea (la serie cargada es el conteo de quejas PROFECO, no esa tasa)" },
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

  if (isUnmeasuredUniverse(t)) return { intent: "unsupported", params: { ...base, missing: "unmeasured" } };

  if (/metodolog|como se calcul|mrp|intervalo|error estandar|coeficiente de variacion|\bcv\b|precision|universo|causal/.test(t))
    return { intent: "methodology_lookup", params: { ...base, topic: t.includes("mrp") ? "mrp" : t.includes("universo") ? "universe" : "precision" } };
  if (/fuente|de donde|endutih|enigh|inegi|vabcoel|citas?/.test(t) && !/cuant|porcentaje|%/.test(t))
    return { intent: "source_lookup", params: base };
  if (/escenario|2030|proyecci|futuro/.test(t)) return { intent: "get_scenario", params: base };
  if (/intervenci|accion|politica|que hacer|puentes|programa/.test(t)) return { intent: "get_interventions", params: base };

  if (/desemple/.test(t))
    return { intent: "get_metric", params: { ...base, metric_code: "unemployment_rate_pct", ...(geo ? { geo_code: geo.geo_code } : {}) } };
  if (/queja|profeco/.test(t))
    return { intent: "get_metric", params: { ...base, metric_code: "profeco_complaints", ...(geo ? { geo_code: geo.geo_code } : {}) } };
  if (/denue|establecimiento|tiendas|oferta formal/.test(t))
    return { intent: "get_metric", params: { ...base, metric_code: "denue_retail_establishments", ...(geo ? { geo_code: geo.geo_code } : {}) } };
  if (/\bcredito\b/.test(t))
    return { intent: "unsupported", params: { ...base, missing: "crédito (no cargado; ENIF cargada cubre captación, tarjeta de débito y transferencia)" } };
  if (/tarjeta|cuenta banc|inclusion financ|celular inteligente|smartphone/.test(t))
    return {
      intent: "get_metric",
      params: { ...base, metric_code: /tarjeta/.test(t) ? "enif_debit_card_pct" : "enif_account_product_pct", ...(geo ? { geo_code: geo.geo_code } : {}) },
    };

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
        : /edad|joven|mayor|generaci|6 a 14 anos|15 a 24 anos|25 a 34 anos|35 a 44 anos|45 a 54 anos|55 a 64 anos|65 a 74 anos|75 anos y mas/.test(t)
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

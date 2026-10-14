"""DENUE courier, freight and warehousing counts for state capitals plus the 16 CDMX alcaldías.

Density uses CNBV March 2026 adult population as the denominator. The token is read from .env and is not written to SQL.
"""

from __future__ import annotations

import json
import unicodedata
import urllib.request
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "drizzle" / "migrations" / "0009_denue_logistics.sql"
VERSION = "2026-10-19"
URL = "https://www.inegi.org.mx/servicios/api_denue.html"
CNBV = ROOT / "data" / "raw" / "Base_de_Datos_de_Inclusion_Financiera_202603.xlsx"

CAPITALS = {
    "01": ["aguascalientes"],
    "02": ["mexicali"],
    "03": ["la paz"],
    "04": ["campeche"],
    "05": ["saltillo"],
    "06": ["colima"],
    "07": ["tuxtla gutierrez"],
    "08": ["chihuahua"],
    "10": ["durango"],
    "11": ["guanajuato"],
    "12": ["chilpancingo de los bravo"],
    "13": ["pachuca de soto"],
    "14": ["guadalajara"],
    "15": ["toluca"],
    "16": ["morelia"],
    "17": ["cuernavaca"],
    "18": ["tepic"],
    "19": ["monterrey"],
    "20": ["oaxaca de juarez"],
    "21": ["puebla", "heroica puebla de zaragoza"],
    "22": ["queretaro"],
    "23": ["othon p blanco"],
    "24": ["san luis potosi"],
    "25": ["culiacan"],
    "26": ["hermosillo"],
    "27": ["centro"],
    "28": ["victoria"],
    "29": ["tlaxcala"],
    "30": ["xalapa"],
    "31": ["merida"],
    "32": ["zacatecas"],
}
NEW_MUNIS = ["02007", "04013", "12082", "12083", "12084", "12085", "24059", "25019", "25020"]
SECTORS = [
    ("492", "denue_courier_establishments", "denue_courier_per_10k_adults", "Mensajería y paquetería"),
    ("484", "denue_freight_establishments", "denue_freight_per_10k_adults", "Autotransporte de carga"),
    ("493", "denue_warehousing_establishments", "denue_warehousing_per_10k_adults", "Almacenamiento"),
]


def norm(text: str) -> str:
    folded = unicodedata.normalize("NFD", text)
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    return " ".join(folded.lower().replace(".", " ").split())


def q(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def token() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("DENUE_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DENUE_TOKEN is missing")


def capitals() -> list[tuple[str, str, str]]:
    geo = json.loads((ROOT / "public" / "geo" / "mx_municipalities_poly.json").read_text())
    by_parent: dict[str, list[tuple[str, str]]] = {}
    for feature in geo["features"]:
        props = feature["properties"]
        by_parent.setdefault(props["parent_geo_code"], []).append((props["geo_code"], props["geo_name"]))
    chosen: list[tuple[str, str, str]] = []
    for parent, names in CAPITALS.items():
        hits = [(code, name) for code, name in by_parent.get(parent, []) if norm(name) in names]
        if len(hits) != 1:
            sample = ", ".join(name for _code, name in by_parent.get(parent, [])[:12])
            raise SystemExit(f"Capital match for {parent} returned {len(hits)}; sample: {sample}")
        code, name = hits[0]
        chosen.append((code, name, parent))
    for code, name in by_parent.get("09", []):
        chosen.append((code, name, "09"))
    if len(by_parent.get("09", [])) != 16:
        raise SystemExit(f"CDMX alcaldías: {len(by_parent.get('09', []))}")
    return chosen


def adults_for(codes: set[str]) -> dict[str, int]:
    wb = openpyxl.load_workbook(CNBV, read_only=True, data_only=True)
    ws = wb["BD Infraestructura Mun"]
    header = None
    found: dict[str, int] = {}
    for row in ws.iter_rows(values_only=True):
        if header is None:
            if any(isinstance(cell, str) and "Clave Municipio" in cell for cell in row):
                header = row
                if "Población adulta" not in str(row[7]):
                    raise SystemExit(f"Column 7 is {row[7]!r}, not adult population")
            continue
        if row[1] is None:
            break
        code = str(int(row[1])).zfill(5)
        if code not in codes:
            continue
        value = row[7]
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        adults = int(float(value))
        if adults <= 0:
            raise SystemExit(f"Non-positive adult population for {code}")
        found[code] = adults
    wb.close()
    missing = codes - found.keys()
    if missing:
        raise SystemExit(f"CNBV has no adult population for {sorted(missing)[:8]}")
    if not 200_000 <= found["01001"] <= 2_000_000:
        raise SystemExit(f"Aguascalientes adult population looks wrong: {found['01001']}")
    return found


def cuantificar(activity: str, areas: list[str], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for start in range(0, len(areas), 8):
        chunk = areas[start : start + 8]
        endpoint = f"https://www.inegi.org.mx/app/api/denue/v1/consulta/Cuantificar/{activity}/{','.join(chunk)}/0/{key}"
        try:
            with urllib.request.urlopen(endpoint, timeout=120) as response:
                payload = json.load(response)
        except Exception as exc:
            raise SystemExit(f"DENUE {activity} failed: {str(exc).replace(key, '[token]')}") from None
        if not isinstance(payload, list):
            raise SystemExit(f"DENUE {activity} did not return a list")
        for item in payload:
            if str(item.get("AE")) != activity:
                continue
            area = str(item.get("AG")).zfill(5)
            if area not in chunk:
                continue
            counts[area] = int(item["Total"])
            if counts[area] < 0:
                raise SystemExit(f"Negative DENUE count for {activity} {area}")
        print("denue", activity, "chunk", start, "rows", len(payload))
    print("denue", activity, "rows", len(counts), "of", len(areas))
    return counts


def fact(metric: str, geo: str, estimate: str, unit: str, note: str) -> str:
    return (
        f"({q(metric)},2026,(select id from public.source_document where source_code='denue_api'),"
        f"{q('Establecimientos del DENUE')},'municipality',{q(geo)},'{{}}'::jsonb,'',"
        f"{estimate},{q(unit)},null,null,null,null,null,'high','observed',"
        f"(select id from public.dim_method where method_code='official_published_aggregate'),{q(VERSION)},null,{q(URL)},{q(note)})"
    )


def main() -> None:
    places = capitals()
    codes = [code for code, _name, _parent in places]
    population = adults_for(set(codes))
    key = token()
    note = (
        "Conteo del método Cuantificar del DENUE, estrato 0, en la cabecera de cada entidad y en las 16 alcaldías de la Ciudad de México. "
        "No es un censo de establecimientos que venden por internet. "
        "La densidad divide ese conteo entre la población adulta municipal publicada por la CNBV en marzo de 2026 (columna Población adulta, hoja BD Infraestructura Mun) y lo expresa por 10 mil adultos. "
        "Numerador y denominador son registros de fechas distintas; no es una tasa muestral y no trae intervalo."
    )
    facts: list[str] = []
    for activity, count_metric, rate_metric, label in SECTORS:
        counts = cuantificar(activity, codes, key)
        sector_note = f"Sector SCIAN {activity} ({label}). " + note
        for code, _name, _parent in places:
            if code not in counts:
                continue
            facts.append(fact(count_metric, code, str(counts[code]), "establecimientos", sector_note))
            rate = counts[code] / population[code] * 10000
            facts.append(fact(rate_metric, code, f"{rate:.2f}", "por 10 mil adultos", sector_note))
    if len(facts) < 40:
        raise SystemExit(f"Too few logistics rows: {len(facts)}")
    geos = []
    seen = set()
    for code, name, parent in places:
        seen.add(code)
        geos.append(f"('municipality',{q(code)},{q(name)},{q(parent)})")
    poly = json.loads((ROOT / "public" / "geo" / "mx_municipalities_poly.json").read_text())
    for feature in poly["features"]:
        props = feature["properties"]
        if props["geo_code"] in NEW_MUNIS and props["geo_code"] not in seen:
            geos.append(f"('municipality',{q(props['geo_code'])},{q(props['geo_name'])},{q(props['parent_geo_code'])})")
    metrics = []
    for activity, count_metric, rate_metric, label in SECTORS:
        metrics.append(
            f"({q(count_metric)},{q('Establecimientos de ' + label.lower())},{q('Conteo DENUE del sector ' + activity + ' en municipios cabecera.')},"
            f"'establecimientos',{q('Establecimientos del DENUE')},'establishment',null::boolean,'denue_api')"
        )
        metrics.append(
            f"({q(rate_metric)},{q(label + ' por 10 mil adultos')},{q('Conteo DENUE del sector ' + activity + ' entre la población adulta municipal de la CNBV.')},"
            f"{q('por 10 mil adultos')},{q('Establecimientos del DENUE por población adulta')},'establishment',null::boolean,'denue_api')"
        )
    sql = [
        "-- Generated by scripts/build_logistics_load.py. Do not edit by hand.",
        "begin;",
        "insert into public.dim_metric(metric_code, metric_label, description, default_unit, universe, universe_type, higher_is_better, status, source_id) "
        "select v.c, v.l, v.d, v.u, v.uni, v.t, v.h, 'published_aggregate', (select id from public.source_document where source_code = v.sc) from (values",
        ",\n".join(metrics),
        ") v(c,l,d,u,uni,t,h,sc) on conflict (metric_code) do nothing;",
        "insert into public.dim_geography(geo_level, geo_code, geo_name, parent_geo_code) values",
        ",\n".join(geos),
        "on conflict (geo_level, geo_code) do nothing;",
        "insert into public.fact_estimate (metric_code, reference_year, source_id, universe, geo_level, geo_code, segment_json, segment_key, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, method_id, version, source_page, source_url, note) values",
        ",\n".join(facts),
        "on conflict (metric_code, reference_year, geo_level, geo_code, segment_key, version) do nothing;",
        "commit;",
    ]
    OUT.write_text("\n".join(sql) + "\n")
    print("wrote", OUT.name, "facts", len(facts), "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()

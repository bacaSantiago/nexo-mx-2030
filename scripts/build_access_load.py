"""Load ENIF 2024 person indicators, Altan locality coverage, DENUE state counts, and the state income x sex x age cross.

Writes drizzle/migrations/0008_access_enif_denue.sql. Does not invent intervals for nonbuyer reasons or for the ENIGH match.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.build_gap_load import (  # noqa: E402
    AGE_LABELS,
    ENDUTIH_SCHOOL,
    MIN_DEN,
    SEX,
    Z90,
    age_coarse,
    Bucket,
    age_label,
    emit_inserts,
    flag_of,
    load_enigh_deciles,
    load_enigh_people,
    pi_lookup,
    q,
    round1,
    seg_key,
)
from scripts.build_reviewed_load import load_person_rows  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "drizzle" / "migrations" / "0008_access_enif_denue.sql"
VERSION = "2026-10-18"
DENUE_SECTORS = (
    ("43", "denue_wholesale_establishments", "Comercio al por mayor"),
    ("46", "denue_retail_establishments", "Comercio al por menor"),
    ("72", "denue_food_lodging_establishments", "Alojamiento y preparación de alimentos"),
)
ACCOUNT_FIELDS = ("P5_4_1", "P5_4_2", "P5_4_3", "P5_4_4", "P5_4_5", "P5_4_6", "P5_4_7", "P5_4_8", "P5_4_9")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def token() -> str:
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("DENUE_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DENUE_TOKEN is missing")


def fact_tuple(metric, year, source, universe, geo_level, geo, segment, estimate, unit, se, lo, hi, cv, precision, observed, method, note, url) -> str:
    def sql_num(value, digits):
        return "null" if value is None else f"{value:.{digits}f}"

    conf = "null" if lo is None else "0.90"
    return (
        f"({q(metric)},{year},(select id from public.source_document where source_code={q(source)}),"
        f"{q(universe)},{q(geo_level)},{q(geo)},{q(json.dumps(segment, ensure_ascii=False))}::jsonb,{q(seg_key(segment))},"
        f"{estimate},{q(unit)},{sql_num(se, 4)},{sql_num(lo, 4)},{sql_num(hi, 4)},{conf},{sql_num(cv, 4)},{q(precision)},{q(observed)},"
        f"(select id from public.dim_method where method_code={q(method)}),{q(VERSION)},null,{q(url)},{q(note)})"
    )


def survey_row(metric, year, source, universe, geo_level, geo, estimate, se, den, note, url) -> str | None:
    if den < MIN_DEN or estimate <= 0:
        return None
    cv = se / estimate * 100
    precision = flag_of(cv)
    if den < 15_000 and precision == "high":
        precision = "low"
    return fact_tuple(
        metric, year, source, universe, geo_level, geo, {}, f"{estimate:.2f}", "percent",
        se, max(0.0, estimate - Z90 * se), min(100.0, estimate + Z90 * se), cv, precision,
        "observed", "survey_design_estimate", note, url,
    )


def published(metric, year, source, universe, geo_level, geo, estimate, unit, note, url) -> str:
    return fact_tuple(
        metric, year, source, universe, geo_level, geo, {}, estimate, unit,
        None, None, None, None, "high", "observed", "official_published_aggregate", note, url,
    )


def source_update(code: str, **fields) -> str:
    sets = ["updated_at = now()"]
    for key, value in fields.items():
        if key == "modules_used":
            inner = ",".join(q(item) for item in value)
            sets.append(f"modules_used = array[{inner}]::text[]")
        elif key == "retrieved_at":
            sets.append("retrieved_at = now()")
        else:
            sets.append(f"{key} = {q(value)}")
    return f"update public.source_document set {', '.join(sets)} where source_code = {q(code)};"


def load_enif(path: Path):
    archive = zipfile.ZipFile(path)
    states = {}
    with archive.open("TVIVIENDA.csv") as handle:
        for row in csv.DictReader(io.TextIOWrapper(handle, encoding="latin-1")):
            states[row["LLAVEVIV"]] = str(int(row["ENT"])).zfill(2)
    indicators = {
        "enif_account_product_pct": lambda row: any(row[field] == "1" for field in ACCOUNT_FIELDS),
        "enif_smartphone_pct": lambda row: row["P3_14"] == "1",
        "enif_debit_card_pct": lambda row: row["FILTRO_S5_3"] == "1",
        "enif_digital_transfer_pct": lambda row: row["P7_7"] == "1",
    }
    buckets = {code: defaultdict(Bucket) for code in indicators}
    used = older = 0
    with archive.open("TMODULO.csv") as handle:
        for row in csv.DictReader(io.TextIOWrapper(handle, encoding="latin-1")):
            try:
                age = int(row["EDAD_V"])
                weight = float(row["FAC_PER"])
            except ValueError:
                continue
            if age > 70:
                older += 1
            if not (18 <= age <= 70) or weight <= 0 or not row["EST_DIS"] or not row["UPM_DIS"]:
                continue
            geo = states.get(row["LLAVEVIV"])
            if geo not in {f"{i:02d}" for i in range(1, 33)}:
                continue
            used += 1
            for code, test in indicators.items():
                y = 1.0 if test(row) else 0.0
                buckets[code]["00"].add(row["EST_DIS"], row["UPM_DIS"], weight, y, 1.0)
                buckets[code][geo].add(row["EST_DIS"], row["UPM_DIS"], weight, y, 1.0)
    url = "https://www.inegi.org.mx/programas/enif/2024/"
    notes = {
        "enif_account_product_pct": "Al menos un sí en P5.4.1 a P5.4.9: nómina, pensión, apoyos, ahorro, cheques, plazo fijo, fondo de inversión, cuenta por internet o aplicación, u otro tipo. Personas de 18 a 70 años. Factor fac_per. Error estándar de Taylor con est_dis y upm.",
        "enif_smartphone_pct": "P3.14, celular inteligente. Personas de 18 a 70 años. Factor fac_per. Error estándar de Taylor con est_dis y upm.",
        "enif_debit_card_pct": "Filtro S5.3, tiene tarjeta de débito. Personas de 18 a 70 años. Factor fac_per. Error estándar de Taylor con est_dis y upm.",
        "enif_digital_transfer_pct": "P7.7, transferencia o envío de dinero por internet o aplicación, de junio de 2023 a la fecha de la entrevista. Personas de 18 a 70 años. Factor fac_per. Error estándar de Taylor con est_dis y upm.",
    }
    universe = "Población de 18 a 70 años"
    facts = []
    for code, grouped in buckets.items():
        for geo, bucket in grouped.items():
            stats = bucket.finish()
            if stats is None:
                continue
            proportion, se, den = stats
            row = survey_row(code, 2024, "enif_2024", universe, "national" if geo == "00" else "state", geo, proportion * 100, se * 100, den, notes[code], url)
            if row:
                facts.append(row)
        national = grouped["00"].finish()
        print(code, None if national is None else round(national[0] * 100, 1))
    if not any("enif_account_product_pct" in row and "'national'" in row for row in facts):
        raise SystemExit("ENIF national account rate was not produced")
    print("enif persons", used, "over 70 excluded", older, "rows", len(facts))
    return facts


def load_altan(path: Path):
    totals = defaultdict(lambda: [0.0, 0.0])
    names = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            try:
                pop = float(row["pobtot"])
            except ValueError:
                continue
            if pop < 0 or row["altan4t25"] not in {"0", "1"}:
                continue
            geo = str(int(row["entidad"])).zfill(2) + str(int(row["mun"])).zfill(3)
            parent = geo[:2]
            names[geo] = (" ".join(row["nom_mun"].split()), parent)
            for key in (geo, parent, "00"):
                totals[key][0] += pop
                if row["altan4t25"] == "1":
                    totals[key][1] += pop
    url = "https://www.ift.org.mx/mapas-de-cobertura-del-servicio-de-datos-moviles"
    note = (
        "Porcentaje de la población de localidades (ITER 2010, columna pobtot) cuya bandera altan4t25 es 1. "
        "El archivo se llama Radiomovil Dipsa, pero las columnas son de Altan, cuarto trimestre de 2025. "
        "No es un porcentaje de cobertura medido en campo ni un polígono municipal. "
        "Los geopaquetes de AT&T y Pegaso son regiones, no se intersectaron."
    )
    facts = []
    geos = []
    for geo, (population, covered) in totals.items():
        if population <= 0:
            continue
        level = "national" if geo == "00" else "state" if len(geo) == 2 else "municipality"
        facts.append(published(
            "altan_covered_population_pct", 2025, "ift_mobile_coverage",
            "Población de las localidades del archivo, ITER 2010", level, geo,
            f"{covered / population * 100:.1f}", "percent", note, url,
        ))
        if level == "municipality":
            name, parent = names[geo]
            geos.append((geo, name, parent))
    national = totals["00"]
    print("altan national", round(national[1] / national[0] * 100, 1), "munis", len(geos))
    return facts, geos


def load_denue() -> list[str]:
    key = token()
    url_doc = "https://www.inegi.org.mx/servicios/api_denue.html"
    facts = []
    for activity, metric, label in DENUE_SECTORS:
        endpoint = f"https://www.inegi.org.mx/app/api/denue/v1/consulta/Cuantificar/{activity}/0/0/{key}"
        with urllib.request.urlopen(endpoint, timeout=60) as response:
            payload = json.load(response)
        counts = {}
        for item in payload:
            if str(item.get("AE")) != activity:
                continue
            area = str(item.get("AG")).zfill(2)
            if area in {f"{i:02d}" for i in range(1, 33)}:
                counts[area] = int(item["Total"])
        if len(counts) != 32:
            print("skip denue", activity, "states", len(counts))
            continue
        note = (
            f"Conteo del método Cuantificar del DENUE, sector SCIAN {activity} ({label}), estrato 0 (todos los tamaños), área estatal. "
            "El total nacional es la suma de las 32 entidades que devolvió esa consulta. "
            "No es un censo de establecimientos que venden por internet. El barrido municipal de la misma API no se cargó."
        )
        total = sum(counts.values())
        facts.append(published(metric, 2026, "denue_api", "Establecimientos del DENUE", "national", "00", str(total), "establecimientos", note, url_doc))
        for geo, count in counts.items():
            facts.append(published(metric, 2026, "denue_api", "Establecimientos del DENUE", "state", geo, str(count), "establecimientos", note, url_doc))
        print("denue", activity, "national", total)
    if not facts:
        raise SystemExit("DENUE Cuantificar returned no state counts")
    return facts


def load_state_income():
    assigned, meta = load_enigh_deciles()
    cells = load_enigh_people(assigned, meta)
    buckets: dict[str, Bucket] = defaultdict(Bucket)
    for row in load_person_rows():
        try:
            age = int(row["EDAD"])
            weight = float(row["FAC_PER"])
        except ValueError:
            continue
        if age < 6 or age > 97 or weight <= 0 or row["SEXO"] not in SEX or row["TLOC"] not in ("1", "2", "3", "4"):
            continue
        school = ENDUTIH_SCHOOL.get(row["NIVEL"].zfill(2), "ne")
        area = "R" if row["TLOC"] == "4" else "U"
        shares = pi_lookup(cells, row["CVE_ENT"].zfill(2), area, row["SEXO"], age_coarse(age), school)
        if not shares:
            continue
        ent = row["CVE_ENT"].zfill(2)
        user = row["P7_1"] == "1"
        sex = SEX[row["SEXO"]]
        label = age_label(age)
        if not sex or not label:
            continue
        for index, share in enumerate(shares):
            if share <= 0:
                continue
            buckets[f"check|00|Decil {index + 1}"].add(row["EST_DIS"], row["UPM_DIS"], weight * share, 1.0 if user else 0.0, 1.0)
            buckets[f"sxage|{ent}|Decil {index + 1}|{sex}|{label}"].add(row["EST_DIS"], row["UPM_DIS"], weight * share, 1.0 if user else 0.0, 1.0)
    series = []
    for decile in range(1, 11):
        stats = buckets[f"check|00|Decil {decile}"].finish()
        series.append(None if not stats else round1(stats[0] * 100))
    print("income check", series)
    if any(value is None for value in series) or series[-1] < series[0] + 5:
        print("income state cross skipped; gradient did not repeat")
        return []
    note = (
        "Cruce estatal de decil imputado, sexo y edad. Misma regla de emparejamiento ENDUTIH-ENIGH ya cargada. "
        "El error estándar es el de muestreo de ENDUTIH condicionado a esa distribución y no incluye la varianza del emparejamiento. "
        "Por eso la precisión no se marca alta. Las celdas con población expandida menor de 2 000 no se publican."
    )
    url = "https://www.inegi.org.mx/contenidos/programas/enigh/nc/2024/microdatos/enigh2024_ns_concentradohogar_csv.zip"
    facts = []
    kept = skipped = 0
    for ent in (f"{i:02d}" for i in range(1, 33)):
        for decile in range(1, 11):
            for sex in SEX.values():
                for _a, _b, age_name in AGE_LABELS:
                    stats = buckets[f"sxage|{ent}|Decil {decile}|{sex}|{age_name}"].finish()
                    if not stats or stats[2] < MIN_DEN:
                        skipped += 1
                        continue
                    proportion, se, _den = stats
                    center = round1(proportion * 100)
                    if center <= 0:
                        skipped += 1
                        continue
                    se_pp = se * 100
                    cv = se_pp / center * 100
                    precision = "moderate" if flag_of(cv) == "high" else flag_of(cv)
                    facts.append(fact_tuple(
                        "internet_users_pct", 2025, "enigh_2024",
                        "Población de 6 años y más de la entidad, decil de ingreso imputado",
                        "state", ent, {"income_decile": f"Decil {decile}", "sex": sex, "age_group": age_name},
                        f"{center:.1f}", "percent", se_pp, max(0.0, center - Z90 * se_pp), min(100.0, center + Z90 * se_pp),
                        cv, precision, "imputed", "multiple_imputation_income", note, url,
                    ))
                    kept += 1
    print("state income x sex x age", kept, "omitted", skipped)
    return facts


def main() -> None:
    enif_path = RAW / "enif_2024_bd_csv.zip"
    altan_path = next(RAW.glob("Mapas*.csv"))
    facts = load_enif(enif_path)
    altan_facts, geos = load_altan(altan_path)
    facts += altan_facts
    facts += load_denue()
    facts += load_state_income()
    sql = ["-- Generated by scripts/build_access_load.py. Do not edit by hand.", "begin;"]
    sql.append(
        "insert into public.dim_metric(metric_code, metric_label, description, default_unit, universe, universe_type, higher_is_better, status, source_id) "
        "select v.c, v.l, v.d, v.u, v.uni, v.t, v.h, 'published_aggregate', (select id from public.source_document where source_code = v.sc) from (values "
        "('enif_account_product_pct','Producto de captación o inversión','Al menos un producto de los que pregunta ENIF en P5.4.','percent','Población de 18 a 70 años','person',true,'enif_2024'),"
        "('enif_smartphone_pct','Celular inteligente','Personas de 18 a 70 años con smartphone, ENIF 2024.','percent','Población de 18 a 70 años','person',true,'enif_2024'),"
        "('enif_debit_card_pct','Tarjeta de débito','Personas de 18 a 70 años con tarjeta de débito, ENIF 2024.','percent','Población de 18 a 70 años','person',true,'enif_2024'),"
        "('enif_digital_transfer_pct','Transferencia digital','Personas de 18 a 70 años que transfirieron dinero por internet o aplicación, ENIF 2024.','percent','Población de 18 a 70 años','person',true,'enif_2024'),"
        "('altan_covered_population_pct','Población en localidades con bandera Altan','Población 2010 en localidades marcadas con cobertura Altan en el cuarto trimestre de 2025.','percent','Población de las localidades del archivo','person',true,'ift_mobile_coverage'),"
        "('denue_wholesale_establishments','Establecimientos de comercio al por mayor','Conteo DENUE del sector 43.','establecimientos','Establecimientos del DENUE','establishment',null::boolean,'denue_api'),"
        "('denue_retail_establishments','Establecimientos de comercio al por menor','Conteo DENUE del sector 46.','establecimientos','Establecimientos del DENUE','establishment',null::boolean,'denue_api'),"
        "('denue_food_lodging_establishments','Establecimientos de alojamiento y alimentos','Conteo DENUE del sector 72.','establecimientos','Establecimientos del DENUE','establishment',null::boolean,'denue_api')"
        ") v(c,l,d,u,uni,t,h,sc) on conflict (metric_code) do nothing;"
    )
    emit_inserts(
        sql,
        "insert into public.fact_estimate (metric_code, reference_year, source_id, universe, geo_level, geo_code, segment_json, segment_key, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, method_id, version, source_page, source_url, note) values",
        facts,
        "on conflict (metric_code, reference_year, geo_level, geo_code, segment_key, version) do nothing;",
    )
    if geos:
        emit_inserts(
            sql,
            "insert into public.dim_geography(geo_level, geo_code, geo_name, parent_geo_code) values",
            [f"('municipality',{q(geo)},{q(name)},{q(parent)})" for geo, name, parent in geos],
            "on conflict (geo_level, geo_code) do nothing;",
        )
    sql.append(source_update(
        "enif_2024", status="curated_included", institution="INEGI", edition="2024",
        universe_description="Población de 18 a 70 años",
        geographic_coverage="Nacional y 32 entidades",
        modules_used=["CSV", "TMODULO", "TVIVIENDA"], sha256=sha256(enif_path), retrieved_at=True,
        notes="Indicadores de persona con fac_per, est_dis y upm. El PDF de resultados no se transcribió. Las edades mayores de 70 que aparecen en el archivo quedaron fuera del universo.",
    ))
    sql.append(source_update(
        "ift_mobile_coverage", status="curated_included", institution="IFT", edition="2025 4T",
        universe_description="Población de localidades con bandera de cobertura Altan",
        geographic_coverage="Nacional, entidad y municipio de las localidades del archivo",
        modules_used=["CSV", "altan4t25"], sha256=sha256(altan_path), retrieved_at=True,
        notes="Solo se agregó la bandera Altan del CSV de localidades, ponderada con población ITER 2010. AT&T_5G y PEGASO_4G son polígonos regionales y siguen sin porcentaje municipal.",
    ))
    sql.append(source_update(
        "denue_api", status="curated_included", institution="INEGI", edition="consulta 2026-10-13",
        universe_description="Establecimientos activos del DENUE",
        geographic_coverage="Nacional y 32 entidades, sectores 43, 46 y 72",
        modules_used=["API", "Cuantificar"], retrieved_at=True,
        notes="Conteos estatales del método Cuantificar. El token no se guarda. El conteo municipal de la misma API queda pendiente porque cada lote tarda decenas de segundos.",
    ))
    sql.append("commit;")
    OUT.write_text("\n".join(sql) + "\n")
    print("wrote", OUT.name, "facts", len(facts), "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()

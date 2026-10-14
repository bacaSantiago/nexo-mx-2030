"""Build migration 0004.

Fills the gaps left after 0003 without replacing a published point:
design-based intervals where the microdata and the publication differ,
direct ENDUTIH crosses (sex x age, state x sex, and the crosses the
filters can combine), income deciles matched from ENIGH 2024, state
scenario grids anchored on each state's own 2025 purchase estimate, and
the census municipal layer (dwellings with internet, 2020).
"""

from __future__ import annotations

import csv
import importlib.util
import json
import math
import re
import zipfile
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("reviewed", ROOT / "scripts/build_reviewed_load.py")
reviewed = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(reviewed)

OUT = ROOT / "drizzle/migrations/0004_gaps_income_geo.sql"
GEOJSON = ROOT / "public/geo/mx_municipalities.json"
ITER_ZIP = Path("/tmp/nexo-src/iter_00_cpv2020_csv.zip")
ENIGH_HOG = Path("/tmp/nexo-src/enigh2024_ns_concentradohogar_csv.zip")
ENIGH_PER = Path("/tmp/nexo-src/enigh2024_ns_poblacion_csv.zip")

Z90 = 1.6448536269514722
Z80 = 1.2815515655446004
VERSION = "2026-10-15"
SCENARIO_VERSION = "difusion-v1"
MIN_DEN = 2_000.0

AGE_LABELS = [
    (6, 14, "6 a 14 años"),
    (15, 24, "15 a 24 años"),
    (25, 34, "25 a 34 años"),
    (35, 44, "35 a 44 años"),
    (45, 54, "45 a 54 años"),
    (55, 64, "55 a 64 años"),
    (65, 74, "65 a 74 años"),
    (75, 97, "75 años y más"),
]
AGE_PUBLISHED = {
    "6 a 14 años": 85.4,
    "15 a 24 años": 97.6,
    "25 a 34 años": 96.5,
    "35 a 44 años": 94.3,
    "45 a 54 años": 88.9,
    "55 a 64 años": 78.8,
    "65 a 74 años": 57.8,
    "75 años y más": 30.3,
}
STATE_USERS = {
    "01": 91.1, "02": 93.2, "03": 91.1, "04": 83.6, "05": 86.3, "06": 89.6, "07": 71.2, "08": 88.8,
    "09": 92.0, "10": 86.0, "11": 85.4, "12": 81.4, "13": 85.3, "14": 88.5, "15": 85.4, "16": 85.1,
    "17": 82.8, "18": 90.1, "19": 93.9, "20": 78.6, "21": 84.4, "22": 88.7, "23": 92.1, "24": 84.0,
    "25": 88.7, "26": 88.8, "27": 84.6, "28": 87.6, "29": 85.2, "30": 81.8, "31": 84.3, "32": 85.9,
}
GAP_STATES = {"05", "08", "09", "12", "13", "16", "17", "22", "25", "27", "29", "30", "32"}
SEX = {"1": "Hombres", "2": "Mujeres"}
AREA = {"U": "Urbano", "R": "Rural"}
BUY = "Comprar productos o servicios"

# ENIGH poblacion.nivelaprob. These codes are not the ENDUTIH NIVEL codes:
# 00 ninguno, 01 preescolar, 02 primaria, 03 secundaria, 04 preparatoria,
# 05 normal, 06 carrera técnica, 07 profesional, 08 especialidad, 09 maestría, 10 doctorado.
ENIGH_SCHOOL = {
    "00": "basica", "01": "basica", "02": "basica",
    "03": "sec",
    "04": "media", "05": "media", "06": "media",
    "07": "sup", "08": "sup", "09": "sup", "10": "sup",
}
ENDUTIH_SCHOOL = {
    "00": "basica", "01": "basica", "02": "basica",
    "03": "sec", "04": "sec", "05": "sec",
    "06": "media", "07": "media",
    "08": "sup", "09": "sup", "10": "sup", "11": "sup",
    "99": "ne",
}


def round1(value: float) -> float:
    return float(Decimal(value).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def q(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def seg_key(obj: dict[str, str]) -> str:
    if not obj:
        return ""
    return "|".join(f"{k}={v}" for k, v in sorted(obj.items()))


def flag_of(cv: float) -> str:
    if cv < 15:
        return "high"
    if cv < 30:
        return "moderate"
    return "low"


def age_label(age: int) -> str | None:
    for a, b, label in AGE_LABELS:
        if a <= age <= b:
            return label
    return None


def age_coarse(age: int) -> str:
    if age < 18:
        return "6-17"
    if age < 35:
        return "18-34"
    if age < 60:
        return "35-59"
    return "60+"


def dms(text: str) -> float | None:
    match = re.match(r"""(\d+)\s*[°º]\s*(\d+)\s*['′]\s*([\d.]+)\s*["″]?\s*([NSEW])""", text.strip())
    if not match:
        return None
    deg, minute, sec, hemi = match.groups()
    value = int(deg) + int(minute) / 60 + float(sec) / 3600
    if hemi in ("S", "W"):
        value = -value
    return value


class Bucket:
    def __init__(self) -> None:
        self.num = 0.0
        self.den = 0.0
        self.clusters: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])

    def add(self, stratum: str, psu: str, weight: float, y: float, x: float) -> None:
        if weight <= 0 or x == 0 or not stratum or not psu:
            return
        self.num += weight * y
        self.den += weight * x
        cell = self.clusters[(stratum, psu)]
        cell[0] += weight * y
        cell[1] += weight * x

    def finish(self) -> tuple[float, float, float] | None:
        if self.den <= 0:
            return None
        p = self.num / self.den
        by_h: dict[str, list[float]] = defaultdict(list)
        for (stratum, _psu), (wy, wx) in self.clusters.items():
            by_h[stratum].append(wy - p * wx)
        var = 0.0
        for zs in by_h.values():
            n_h = len(zs)
            if n_h < 2:
                continue
            mean = sum(zs) / n_h
            var += (n_h / (n_h - 1.0)) * sum((z - mean) ** 2 for z in zs)
        se = math.sqrt(max(var, 0.0)) / self.den
        if not math.isfinite(se) or se <= 0:
            return None
        return p, se, self.den


def emit_inserts(sql: list[str], table_sql: str, rows: list[str], conflict: str) -> None:
    for i in range(0, len(rows), 400):
        chunk = rows[i : i + 400]
        sql.append(table_sql)
        sql.append(",\n".join(chunk))
        sql.append(conflict)


def fact_tuple(
    metric: str,
    geo_level: str,
    geo: str,
    segment: dict[str, str],
    universe: str,
    center: float,
    se: float,
    cv: float,
    precision: str,
    observed: str,
    method: str,
    source: str,
    note: str,
    url: str,
) -> str:
    lo = max(0.0, center - Z90 * se)
    hi = min(100.0, center + Z90 * se)
    return (
        f"({q(metric)},2025,(select id from public.source_document where source_code={q(source)}),"
        f"{q(universe)},{q(geo_level)},{q(geo)},{q(json.dumps(segment, ensure_ascii=False))}::jsonb,{q(seg_key(segment))},"
        f"{center:.1f},'percent',{se:.6f},{lo:.6f},{hi:.6f},0.90,{cv:.6f},{q(precision)},{q(observed)},"
        f"(select id from public.dim_method where method_code={q(method)}),{q(VERSION)},null,{q(url)},{q(note)})"
    )


def load_enigh_deciles() -> dict[tuple[str, str], int]:
    z = zipfile.ZipFile(ENIGH_HOG)
    with z.open("concentradohogar.csv") as fh:
        homes = list(csv.DictReader((line.decode("utf-8-sig") for line in fh)))
    ranked = []
    for row in homes:
        factor = float(row["factor"])
        if factor <= 0:
            continue
        ranked.append((float(row["ing_cor"]), row["folioviv"], row["foliohog"], factor, row))
    ranked.sort()
    total = sum(item[3] for item in ranked)
    width = int(total // 10)
    if width <= 0:
        raise SystemExit("ENIGH factor total is empty")
    assigned: dict[tuple[str, str], int] = {}
    shares = [0.0] * 10
    cum = 0.0
    meta: dict[tuple[str, str], tuple[str, str, str]] = {}
    for income, folioviv, foliohog, factor, row in ranked:
        mid = cum + factor / 2
        decile = min(10, max(1, int(mid // width) + 1))
        assigned[(folioviv, foliohog)] = decile
        shares[decile - 1] += factor
        meta[(folioviv, foliohog)] = (row["ubica_geo"][:2].zfill(2), row["tam_loc"].zfill(1), row["ing_cor"])
        cum += factor
    print("ENIGH household decile shares:", [round(s / total * 100, 2) for s in shares])
    return assigned, meta


def load_enigh_people(assigned, meta) -> dict[str, list[float]]:
    z = zipfile.ZipFile(ENIGH_PER)
    name = [n for n in z.namelist() if n.endswith(".csv")][0]
    with z.open(name) as fh:
        reader = csv.DictReader((line.decode("utf-8-sig") for line in fh))
        fields = set(reader.fieldnames or [])
        level_col = next((c for c in ("nivelaprob", "nivel_aprob", "niv_academ") if c in fields), None)
        if level_col is None or "sexo" not in fields or "edad" not in fields:
            raise SystemExit(f"ENIGH poblacion columns not recognized: {sorted(fields)[:40]}")
        print(f"ENIGH schooling column: {level_col}")
        cells: dict[str, list[float]] = defaultdict(lambda: [0.0] * 11)
        unknown = defaultdict(float)
        for row in reader:
            key = (row["folioviv"], row["foliohog"])
            if key not in assigned:
                continue
            try:
                age = int(row["edad"])
                weight = float(row["factor"])
            except ValueError:
                continue
            if age < 6 or weight <= 0 or row["sexo"] not in ("1", "2"):
                continue
            info = meta[key]
            school = ENIGH_SCHOOL.get(row[level_col].zfill(2))
            if school is None:
                unknown[row[level_col]] += weight
                school = "ne"
            area = "R" if info[1] == "4" else "U"
            cell = f"{info[0]}|{area}|{row['sexo']}|{age_coarse(age)}|{school}"
            bucket = cells[cell]
            bucket[assigned[key] - 1] += weight
            bucket[10] += 1
        if unknown:
            print("ENIGH schooling codes outside the map (collapsed to ne):", dict(unknown))
    # Marginal cells for the fallback, built from the full cells.
    marginal: dict[str, list[float]] = defaultdict(lambda: [0.0] * 11)
    for cell, weights in cells.items():
        ent, area, sex, agec, school = cell.split("|")
        for key in (f"{area}|{sex}|{agec}|{school}", f"{area}|{school}", school, "all"):
            dest = marginal[key]
            for i in range(11):
                dest[i] += weights[i]
    cells.update(marginal)
    return cells


def pi_lookup(cells: dict[str, list[float]], ent: str, area: str, sex: str, agec: str, school: str) -> list[float] | None:
    for key in (f"{ent}|{area}|{sex}|{agec}|{school}", f"{area}|{sex}|{agec}|{school}", f"{area}|{school}", school, "all"):
        weights = cells.get(key)
        if not weights or weights[10] < 40:
            continue
        total = sum(weights[:10])
        if total <= 0:
            continue
        return [w / total for w in weights[:10]]
    return None


def main() -> None:
    K, r, t0, sigma = reviewed.fit_logistic()
    f2025 = reviewed.logistic(2025, K, r, t0)
    skills_pp = 11.5 / 100 * reviewed.NONBUYERS_M / reviewed.USERS_M * 100
    trust_pp = 5.2 / 100 * reviewed.NONBUYERS_M / reviewed.USERS_M * 100
    print(f"logistic K={K:.2f} r={r:.4f} t0={t0:.2f} sigma={sigma:.3f} skills={skills_pp:.3f} trust={trust_pp:.3f}")

    people = reviewed.load_person_rows()
    buckets: dict[str, Bucket] = defaultdict(Bucket)
    state_users = defaultdict(float)
    state_rural_users = defaultdict(float)
    national_users = 0.0

    def add(name: str, row: dict[str, str], y: float, x: float, weight: float | None = None) -> None:
        buckets[name].add(row["EST_DIS"], row["UPM_DIS"], weight if weight is not None else float(row["FAC_PER"]), y, x)

    for row in people:
        try:
            age = int(row["EDAD"])
            weight = float(row["FAC_PER"])
        except ValueError:
            continue
        if age < 6 or age > 97 or weight <= 0:
            continue
        ent = row["CVE_ENT"].zfill(2)
        sex = SEX.get(row["SEXO"])
        area = AREA.get(row["DOMINIO"])
        label = age_label(age)
        user = 1.0 if row["P7_1"] == "1" else 0.0
        if area == "Rural":
            add("gap|rural", row, user, 1.0)
        if ent in STATE_USERS:
            add(f"gap|state|{ent}", row, user, 1.0)
        if label:
            add(f"gap|age|{label}", row, user, 1.0)
        if sex and label:
            add(f"x|sex-age|{sex}|{label}", row, user, 1.0)
            add(f"x|state-sex-age|{ent}|{sex}|{label}", row, user, 1.0)
        if sex and area:
            add(f"x|sex-area|{sex}|{area}", row, user, 1.0)
        if label and area:
            add(f"x|age-area|{label}|{area}", row, user, 1.0)
        if sex:
            add(f"x|state-sex|{ent}|{sex}", row, user, 1.0)
        if label:
            add(f"x|state-age|{ent}|{label}", row, user, 1.0)
        if area:
            add(f"x|state-area|{ent}|{area}", row, user, 1.0)
        if user == 1.0:
            national_users += weight
            state_users[ent] += weight
            if row["DOMINIO"] == "R":
                state_rural_users[ent] += weight
            buyer = 1.0 if row["P7_21"] == "1" else 0.0
            add(f"buy|state|{ent}", row, buyer, 1.0)
            if sex and label:
                add(f"buy|sex-age|{sex}|{label}", row, buyer, 1.0)
            if sex and area:
                add(f"buy|sex-area|{sex}|{area}", row, buyer, 1.0)
            if sex:
                add(f"buy|state-sex|{ent}|{sex}", row, buyer, 1.0)

    def done(name: str) -> tuple[float, float, float] | None:
        stats = buckets[name].finish()
        if not stats or stats[2] < MIN_DEN:
            return None
        return stats

    sql: list[str] = [
        "-- Generated by scripts/build_gap_load.py. Do not edit by hand.",
        "-- Precision gaps, direct crosses, ENIGH income match, state scenarios, municipal census layer.",
        "begin;",
    ]
    updates = 0
    gap_note_ok = (
        "Error estándar por linealización de Taylor con FAC_PER, estrato EST_DIS y UPM UPM_DIS. "
        "Intervalo al 90 %. El punto publicado no se reemplaza."
    )

    def emit_gap(name: str, metric: str, geo: str, segment: dict[str, str], published: float) -> None:
        nonlocal updates
        stats = buckets[name].finish()
        if not stats:
            print(f"  no SE {name}")
            return
        _p, se, _den = stats
        micro = _p * 100
        se_pp = se * 100
        center = published
        cv = se_pp / center * 100
        lo = max(0.0, center - Z90 * se_pp)
        hi = min(100.0, center + Z90 * se_pp)
        if abs(micro - published) < 0.055:
            note = gap_note_ok
        else:
            note = (
                f"El microdato de la persona seleccionada da {micro:.2f} % y la publicación {published:.1f} %. "
                "El punto publicado no se reemplaza. El error estándar es el de ese estimador y el intervalo al 90 % se centra en el punto publicado."
            )
        sql.append(
            "update public.fact_estimate set "
            f"standard_error = {se_pp:.6f}, ci_low = {lo:.6f}, ci_high = {hi:.6f}, confidence_level = 0.90, "
            f"cv = {cv:.6f}, precision_flag = {q(flag_of(cv))}, "
            "method_id = (select id from public.dim_method where method_code = 'survey_design_estimate'), "
            f"note = concat_ws(' ', note, {q(note)}) "
            f"where metric_code = {q(metric)} and reference_year = 2025 and geo_code = {q(geo)} "
            f"and segment_key = {q(seg_key(segment))} and version = '2026-10-13' and standard_error is null;"
        )
        updates += 1
        print(f"  gap {geo} {seg_key(segment) or 'total'}: micro {micro:.2f} published {published} se {se_pp:.3f}")

    print("Precision gaps:")
    emit_gap("gap|rural", "internet_users_pct", "00", {"area": "Rural"}, 75.2)
    for ent in sorted(GAP_STATES):
        emit_gap(f"gap|state|{ent}", "internet_users_pct", ent, {}, STATE_USERS[ent])
    for label, published in AGE_PUBLISHED.items():
        emit_gap(f"gap|age|{label}", "internet_users_pct", "00", {"age_group": label}, published)
    print(f"gap updates {updates}")

    inserts: list[str] = []
    url_endutih = "https://www.inegi.org.mx/contenidos/programas/endutih/2025/datosabiertos/conjunto_de_datos_endutih_2025_csv.zip"
    direct_note = (
        "Estimación directa ENDUTIH 2025 (persona seleccionada, FAC_PER). Este cruce no está en la presentación. "
        "Error estándar por linealización de Taylor con EST_DIS y UPM_DIS. Intervalo al 90 %. "
        "Se omite la celda si el denominador expandido es menor a 2 000 personas."
    )

    def push_direct(stats, metric: str, geo: str, segment: dict[str, str], universe: str) -> None:
        if not stats:
            return
        p, se, _den = stats
        center = round1(p * 100)
        se_pp = se * 100
        if center <= 0:
            return
        cv = se_pp / center * 100
        precision = flag_of(cv)
        if _den < 15_000:
            precision = "low" if precision == "high" else precision
        inserts.append(fact_tuple(
            metric, "state" if geo != "00" else "national", geo, segment, universe, center, se_pp, cv,
            precision, "observed", "survey_design_estimate", "endutih_2025", direct_note, url_endutih,
        ))

    for sex in SEX.values():
        for _a, _b, label in AGE_LABELS:
            push_direct(done(f"x|sex-age|{sex}|{label}"), "internet_users_pct", "00", {"sex": sex, "age_group": label}, "Población de 6 años y más")
            push_direct(done(f"buy|sex-age|{sex}|{label}"), "internet_use_type_pct", "00", {"sex": sex, "age_group": label, "use_type": BUY}, "Personas usuarias de internet")
        for area in AREA.values():
            push_direct(done(f"x|sex-area|{sex}|{area}"), "internet_users_pct", "00", {"sex": sex, "area": area}, "Población de 6 años y más")
            push_direct(done(f"buy|sex-area|{sex}|{area}"), "internet_use_type_pct", "00", {"sex": sex, "area": area, "use_type": BUY}, "Personas usuarias de internet")
    for _a, _b, label in AGE_LABELS:
        for area in AREA.values():
            push_direct(done(f"x|age-area|{label}|{area}"), "internet_users_pct", "00", {"age_group": label, "area": area}, "Población de 6 años y más")
    state_purchase: dict[str, tuple[float, float]] = {}
    for ent in [f"{i:02d}" for i in range(1, 33)]:
        stats = done(f"buy|state|{ent}")
        if stats:
            state_purchase[ent] = (round1(stats[0] * 100), stats[1] * 100)
            push_direct(stats, "internet_use_type_pct", ent, {"use_type": BUY}, "Personas usuarias de internet de la entidad")
        for sex in SEX.values():
            push_direct(done(f"x|state-sex|{ent}|{sex}"), "internet_users_pct", ent, {"sex": sex}, "Población de 6 años y más de la entidad")
            push_direct(done(f"buy|state-sex|{ent}|{sex}"), "internet_use_type_pct", ent, {"sex": sex, "use_type": BUY}, "Personas usuarias de internet de la entidad")
            for _a, _b, label in AGE_LABELS:
                push_direct(done(f"x|state-sex-age|{ent}|{sex}|{label}"), "internet_users_pct", ent, {"sex": sex, "age_group": label}, "Población de 6 años y más de la entidad")
        for _a, _b, label in AGE_LABELS:
            push_direct(done(f"x|state-age|{ent}|{label}"), "internet_users_pct", ent, {"age_group": label}, "Población de 6 años y más de la entidad")
        for area in AREA.values():
            push_direct(done(f"x|state-area|{ent}|{area}"), "internet_users_pct", ent, {"area": area}, "Población de 6 años y más de la entidad")
    print(f"direct crosses {len(inserts)}; states with purchase {len(state_purchase)}; national users {national_users/1e6:.2f}m")

    print("Income match:")
    assigned, meta = load_enigh_deciles()
    cells = load_enigh_people(assigned, meta)
    income_buckets: dict[str, Bucket] = defaultdict(Bucket)
    matched = skipped = 0
    for row in people:
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
            skipped += 1
            continue
        matched += 1
        ent = row["CVE_ENT"].zfill(2)
        user = row["P7_1"] == "1"
        buyer = 1.0 if user and row["P7_21"] == "1" else 0.0
        sex = SEX[row["SEXO"]]
        label = age_label(age)
        dominio = AREA.get(row["DOMINIO"])
        for index, share in enumerate(shares):
            if share <= 0:
                continue
            weighted = weight * share
            decile = f"Decil {index + 1}"
            for geo in ("00", ent):
                income_buckets[f"net|{geo}|{decile}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, 1.0 if user else 0.0, 1.0)
                if user:
                    income_buckets[f"buy|{geo}|{decile}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, buyer, 1.0)
            if sex:
                income_buckets[f"netsex|00|{decile}|{sex}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, 1.0 if user else 0.0, 1.0)
            if label:
                income_buckets[f"netage|00|{decile}|{label}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, 1.0 if user else 0.0, 1.0)
            if dominio:
                income_buckets[f"netarea|00|{decile}|{dominio}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, 1.0 if user else 0.0, 1.0)
            school_label = reviewed.SCHOOL_LABEL.get(row["NIVEL"].zfill(2))
            if school_label:
                income_buckets[f"netsch|00|{decile}|{school_label}"].add(row["EST_DIS"], row["UPM_DIS"], weighted, 1.0 if user else 0.0, 1.0)
    print(f"  matched persons {matched} skipped {skipped}")
    income_note = (
        "Decil de hogar según el ingreso corriente total de ENIGH 2024 (ing_cor), con el tamaño de decil trunc(suma de factor / 10) "
        "de la guía oficial. El hogar que cruza la frontera queda en el decil de su peso medio; no se parte el factor. "
        "Cada persona de ENDUTIH recibe la distribución de deciles de su celda ENIGH (entidad, tamaño de localidad, sexo, edad y escolaridad agrupada), "
        "con respaldo a celdas más amplias si hay menos de 40 personas ENIGH. "
        "El error estándar es el de muestreo de ENDUTIH condicionado a esa distribución: no incluye la varianza del emparejamiento. "
        "Por eso la precisión no se marca alta. No es un ingreso observado en ENDUTIH ni un decil de ENIGH publicado para usuarios de internet."
    )
    url_enigh = "https://www.inegi.org.mx/contenidos/programas/enigh/nc/2024/microdatos/enigh2024_ns_concentradohogar_csv.zip"
    income_rows = 0
    series = []

    def push_income(name: str, geo: str, segment: dict[str, str], metric: str, universe: str) -> None:
        nonlocal income_rows
        stats = income_buckets[name].finish()
        if not stats or stats[2] < MIN_DEN:
            return
        p, se, _den = stats
        center = round1(p * 100)
        se_pp = se * 100
        if center <= 0:
            return
        cv = se_pp / center * 100
        precision = flag_of(cv)
        if precision == "high":
            precision = "moderate"
        inserts.append(fact_tuple(
            metric, "state" if geo != "00" else "national", geo, segment, universe, center, se_pp, cv,
            precision, "imputed", "multiple_imputation_income", "enigh_2024", income_note, url_enigh,
        ))
        income_rows += 1
        if metric == "internet_users_pct" and geo == "00" and list(segment) == ["income_decile"]:
            series.append((segment["income_decile"], center))

    for decile in range(1, 11):
        label = f"Decil {decile}"
        push_income(f"net|00|{label}", "00", {"income_decile": label}, "internet_users_pct", "Población de 6 años y más, decil de ingreso imputado")
        push_income(f"buy|00|{label}", "00", {"income_decile": label, "use_type": BUY}, "internet_use_type_pct", "Personas usuarias de internet, decil de ingreso imputado")
        for sex in SEX.values():
            push_income(f"netsex|00|{label}|{sex}", "00", {"income_decile": label, "sex": sex}, "internet_users_pct", "Población de 6 años y más, decil de ingreso imputado")
        for _a, _b, age_name in AGE_LABELS:
            push_income(f"netage|00|{label}|{age_name}", "00", {"income_decile": label, "age_group": age_name}, "internet_users_pct", "Población de 6 años y más, decil de ingreso imputado")
        for area in AREA.values():
            push_income(f"netarea|00|{label}|{area}", "00", {"income_decile": label, "area": area}, "internet_users_pct", "Población de 6 años y más, decil de ingreso imputado")
        for school_label in reviewed.SCHOOL_LABEL.values():
            push_income(f"netsch|00|{label}|{school_label}", "00", {"income_decile": label, "schooling": school_label}, "internet_users_pct", "Población de 6 años y más, decil de ingreso imputado")
        for ent in [f"{i:02d}" for i in range(1, 33)]:
            push_income(f"net|{ent}|{label}", ent, {"income_decile": label}, "internet_users_pct", "Población de 6 años y más de la entidad, decil de ingreso imputado")
            push_income(f"buy|{ent}|{label}", ent, {"income_decile": label, "use_type": BUY}, "internet_use_type_pct", "Personas usuarias de internet de la entidad, decil de ingreso imputado")
    print("  national internet by decile:", series)
    if len(series) != 10 or series[-1][1] < series[0][1] + 5:
        raise SystemExit(f"Income match did not reproduce the expected gradient: {series}")
    print(f"  income rows {income_rows}")

    emit_inserts(
        sql,
        "insert into public.fact_estimate (metric_code, reference_year, source_id, universe, geo_level, geo_code, segment_json, segment_key, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, method_id, version, source_page, source_url, note) values",
        inserts,
        "on conflict (metric_code, reference_year, geo_level, geo_code, segment_key, version) do nothing;",
    )
    sql.append(
        "insert into public.dim_segment(segment_code, dimension, value, label) "
        "select distinct lower(regexp_replace(k||'_'||v,'[^a-zA-Z0-9]+','_','g')), k, v, v "
        "from public.fact_estimate, jsonb_each_text(segment_json) e(k,v) "
        "on conflict (segment_code) do nothing;"
    )

    print("State scenarios:")
    def s0_path(year: int, ritmo: float, anchor: float) -> float:
        inc = reviewed.logistic(year, K, r, t0) - f2025
        return min(95.0, max(0.0, anchor + ritmo * inc))

    scenarios = {
        "s0": ("ritmo", [0.8, 1.0, 1.2]),
        "s1": ("alivio_habilidades", [0, 25, 50]),
        "s2": ("alivio_confianza", [0, 20, 40]),
        "s3": ("cierre_brecha", [0, 5, 10]),
    }

    def adoption(code: str, year: int, value: float, anchor: float, rural_share: float) -> float:
        base = s0_path(year, 1.0, anchor)
        phase = (year - 2025) / 5.0
        if code == "s0":
            return s0_path(year, value, anchor)
        if code == "s1":
            return min(95.0, base + skills_pp * (value / 100.0) * phase)
        if code == "s2":
            return min(95.0, base + trust_pp * (value / 100.0) * phase)
        return min(95.0, base + rural_share * value * phase)

    scenario_values: list[str] = []
    for ent, (anchor, se_pp) in sorted(state_purchase.items()):
        users_n = state_users[ent]
        rural_share = state_rural_users[ent] / users_n if users_n else 0.0
        user_share = users_n / national_users if national_users else 0.0
        for code, (param, grid) in scenarios.items():
            for value in grid:
                assumptions = {param: value}
                for year in range(2025, 2031):
                    est = adoption(code, year, value, anchor, rural_share)
                    horizon = 1.0 + (year - 2025) / 5.0
                    half = Z80 * math.sqrt((sigma * math.sqrt(horizon)) ** 2 + se_pp ** 2)
                    p10, p90 = max(0.0, est - half), min(100.0, est + half)
                    base = adoption("s0", year, 1.0, anchor, rural_share)
                    extra = (est - base) / 100.0 * users_n
                    b10 = (p10 - base) / 100.0 * users_n
                    b90 = (p90 - base) / 100.0 * users_n
                    gap = 0.0 if code != "s3" else value * (year - 2025) / 5.0
                    econ = reviewed.VAB_MXN_M * user_share * max(est / reviewed.BUY_2024 - 1.0, 0.0)
                    rows_out = [
                        (code, "scenario_adoption_pct", year, est, p10, p90, "percent", ""),
                        (code, "scenario_additional_buyers", year, extra, b10, b90, "persons", ""),
                        (code, "scenario_gap_reduction_pp", year, gap, None, None, "percentage_points", ""),
                        (code, "scenario_economic_impact_mxn", year, econ * 0.75, econ * 0.50, econ * 1.0, "mxn_millions", ""),
                    ]
                    for item in rows_out:
                        metric, year_i, estimate, lo, hi, unit, component = item[1], item[2], item[3], item[4], item[5], item[6], item[7]
                        lo_sql = "null" if lo is None else f"{lo:.6f}"
                        hi_sql = "null" if hi is None else f"{hi:.6f}"
                        mid_sql = "null" if lo is None else f"{estimate:.6f}"
                        scenario_values.append(
                            f"({q(code)},{q(metric)},{year_i},'state',{q(ent)},'',{q(component)},{estimate:.6f},{lo_sql},{mid_sql},{hi_sql},{q(unit)},'scenario',{q(SCENARIO_VERSION)},{q(json.dumps(assumptions, separators=(',', ':')))}::jsonb)"
                        )
                gain_base = adoption("s0", 2030, 1.0, anchor, rural_share) - anchor
                total_gain = adoption(code, 2030, value, anchor, rural_share) - anchor
                parts = [("Inercial", gain_base if code != "s0" else total_gain)]
                if code == "s1":
                    parts.append(("Habilidades", total_gain - gain_base))
                elif code == "s2":
                    parts.append(("Confianza", total_gain - gain_base))
                elif code == "s3":
                    parts.append(("Brecha rural", total_gain - gain_base))
                for label, pp in parts:
                    scenario_values.append(
                        f"({q(code)},'scenario_contribution_pp',2030,'state',{q(ent)},'',{q(label)},{pp:.6f},null,null,null,'percentage_points','scenario',{q(SCENARIO_VERSION)},{q(json.dumps(assumptions, separators=(',', ':')))}::jsonb)"
                    )
        print(f"  {ent} anchor {anchor:.1f} se {se_pp:.2f} rural {rural_share:.3f} 2030 s0 {adoption('s0', 2030, 1.0, anchor, rural_share):.2f}")
    emit_inserts(
        sql,
        "insert into public.scenario_result (scenario_code, metric_code, reference_year, geo_level, geo_code, segment_code, component_code, estimate, p10, p50, p90, unit, observed_or_modeled, assumptions_version, assumption_values) values",
        scenario_values,
        "on conflict on constraint scenario_result_grid_key do nothing;",
    )
    sql.append(f"""
insert into public.source_lineage(fact_table, fact_id, source_id, source_page, source_url, transformation, loaded_version)
select 'scenario_result', r.id, s.id, null, s.official_url,
  'Misma logística nacional anclada en la compra 2025 de la entidad, estimada directo del microdato (no publicada por entidad). El incremento en puntos es el de la serie nacional; no es una tasa estatal observada en 2030. p10-p90 combina el residual nacional y el error de muestreo estatal de 2025. Compradores adicionales usan las personas usuarias de la entidad en 2025. El VABCOEL se reparte con el peso de esas personas usuarias: no es un VAB estatal. Habilidades y confianza siguen siendo las razones nacionales publicadas (11.5 % y 5.2 %), porque el microdato de esas preguntas no reproduce la presentación.',
  {q(SCENARIO_VERSION)}
from public.scenario_result r
join public.source_document s on s.source_code = 'endutih_2025'
where r.geo_level = 'state' and r.assumptions_version = {q(SCENARIO_VERSION)}
  and not exists (select 1 from public.source_lineage l where l.fact_table = 'scenario_result' and l.fact_id = r.id);
""")

    print("Municipal census:")
    municipalities, features = read_iter()
    geo_rows = [
        f"('municipality',{q(code)},{q(name)},{q(parent)})"
        for code, name, parent, _pct in municipalities
    ]
    emit_inserts(
        sql,
        "insert into public.dim_geography (geo_level, geo_code, geo_name, parent_geo_code) values",
        geo_rows,
        "on conflict (geo_level, geo_code) do nothing;",
    )
    sql.append("""
insert into public.source_document(source_code, source_name, title, year, tier, resource_type, official_url, purpose, bundle_status, status)
select 'cpv_2020_iter', 'Censo 2020 ITER', 'Principales resultados por localidad (ITER) 2020', 2020, 'extended', 'CSV',
  'https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/iter/iter_00_cpv2020_csv.zip',
  'Viviendas particulares habitadas con internet por municipio', 'downloaded for the municipal layer', 'curated_included'
where not exists (select 1 from public.source_document where source_code = 'cpv_2020_iter');
""")
    sql.append("create temporary table _mun (geo_code text primary key, estimate numeric) on commit drop;")
    emit_inserts(sql, "insert into _mun (geo_code, estimate) values", [f"({q(code)},{pct:.4f})" for code, _n, _p, pct in municipalities], "on conflict (geo_code) do nothing;")
    sql.append(f"""
insert into public.fact_supply (indicator_code, indicator_label, reference_year, source_id, universe, geo_level, geo_code, estimate, unit, precision_flag, observed_or_modeled, method_id, version)
select 'dwellings_with_internet_pct', 'Viviendas particulares habitadas con internet', 2020, s.id,
  'Viviendas particulares habitadas', 'municipality', m.geo_code, m.estimate, 'percent', 'high', 'observed', d.id, {q(VERSION)}
from _mun m
join public.source_document s on s.source_code = 'cpv_2020_iter'
join public.dim_method d on d.method_code = 'official_published_aggregate'
where not exists (
  select 1 from public.fact_supply f
  where f.indicator_code = 'dwellings_with_internet_pct' and f.reference_year = 2020 and f.geo_code = m.geo_code and f.version = {q(VERSION)}
);
""")
    GEOJSON.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  municipalities {len(municipalities)} points {len(features)} geojson {GEOJSON.stat().st_size} bytes")

    sql.append("""
insert into public.methodology_note(note_code, title, body, topic, source_id) values
('precision_gap_v1','Intervalos donde el microdato no calza el decimal',
 'En el uso rural de internet y en 13 entidades el microdato no reproduce el decimal publicado, así que la carga anterior dejó el error vacío. Aquí el punto publicado se conserva. El error estándar es el del estimador de la persona seleccionada y el intervalo al 90 % se centra en ese punto publicado. La nota de la fila guarda el valor del microdato. Los grupos de edad 2025 reciben el mismo tratamiento.',
 'precision', (select id from public.source_document where source_code='endutih_2025')),
('crosstab_v1','Cruces de sexo, edad, ámbito y entidad',
 'Sexo por edad, sexo por ámbito, edad por ámbito, y los cortes estatales de sexo, edad y ámbito salen del microdato ENDUTIH 2025. No están en la presentación. Una celda con menos de 2 000 personas expandidas no se carga. La compra estatal entre personas usuarias tampoco está publicada: es la estimación directa que ancla el escenario de esa entidad.',
 'precision', (select id from public.source_document where source_code='endutih_2025')),
('income_match_v1','Decil de ingreso imputado',
 'ENDUTIH no pregunta ingreso. El decil es el del hogar en ENIGH 2024 según ingreso corriente total, con la regla de la guía oficial (decil de hogares, no per cápita). La persona de ENDUTIH hereda la mezcla de deciles de una celda común: entidad, localidad de menos o más de 2 500 habitantes, sexo, grupo de edad y escolaridad agrupada. Si la celda ENIGH tiene menos de 40 personas, se usa una celda más amplia. El estrato socioeconómico de ENDUTIH no se usa como decil. La precisión nunca se marca alta porque el error no cubre el emparejamiento.',
 'imputation', (select id from public.source_document where source_code='enigh_2024')),
('state_scenario_v1','Escenarios 2030 por entidad',
 'Cada entidad usa como ancla de 2025 su propia estimación de compra entre personas usuarias. De ahí en adelante suma los mismos puntos de la logística nacional, no una tasa observada. Las razones de habilidades y confianza siguen siendo las nacionales publicadas, porque las preguntas del microdato no reproducen 11.5 % y 5.2 %. El peso en pesos reparte el VABCOEL nacional según las personas usuarias de la entidad.',
 'scenario', (select id from public.source_document where source_code='endutih_2025')),
('municipal_census_v1','Internet en viviendas por municipio',
 'El porcentaje municipal es VPH_INTER / TVIVPARHAB de la fila Total del Municipio del ITER del Censo de Población y Vivienda 2020. Es un censo de viviendas, no la ENDUTIH de personas y no es 2025. No hay error de muestreo. El punto del mapa es el centroide de las localidades del municipio ponderado por población. No incluye DENUE, sucursales CNBV ni cobertura IFT.',
 'geography', (select id from public.source_document where source_code='cpv_2020_iter'))
on conflict (note_code) do update set body = excluded.body, title = excluded.title;

update public.methodology_note set body = 'La escolaridad sale del microdato abierto ENDUTIH 2025 (variable NIVEL, factor FAC_PER). El error estándar usa estrato y UPM. El decil de ingreso imputado está en la nota income_match_v1: no es el estrato socioeconómico de ENDUTIH.'
where note_code = 'schooling_precision_v1';
""")
    sql.append("commit;")
    OUT.write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


def read_iter() -> tuple[list[tuple[str, str, str, float]], list[dict]]:
    z = zipfile.ZipFile(ITER_ZIP)
    weights: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0, 0.0])
    municipalities: list[tuple[str, str, str, float]] = []
    with z.open("iter_00_cpv2020/conjunto_de_datos/conjunto_de_datos_iter_00CSV20.csv") as fh:
        for row in csv.DictReader((line.decode("utf-8-sig") for line in fh)):
            ent = row["ENTIDAD"].zfill(2)
            mun = row["MUN"].zfill(3)
            if ent == "00" or mun == "000":
                continue
            code = ent + mun
            if row["NOM_LOC"] == "Total del Municipio":
                try:
                    lived = float(row["TVIVPARHAB"])
                    online = float(row["VPH_INTER"])
                except ValueError:
                    continue
                if lived <= 0:
                    continue
                municipalities.append((code, row["NOM_MUN"].strip(), ent, online / lived * 100))
                continue
            if row["LOC"] in ("0000", "9998", "9999"):
                continue
            lng = dms(row["LONGITUD"])
            lat = dms(row["LATITUD"])
            if lng is None or lat is None:
                continue
            try:
                pop = float(row["POBTOT"])
            except ValueError:
                pop = 0.0
            if pop <= 0:
                continue
            cell = weights[code]
            cell[0] += lng * pop
            cell[1] += lat * pop
            cell[2] += pop
    features = []
    for code, name, parent, _pct in municipalities:
        cell = weights.get(code)
        if not cell or cell[2] <= 0:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(cell[0] / cell[2], 5), round(cell[1] / cell[2], 5)]},
            "properties": {"geo_code": code, "geo_name": name, "parent_geo_code": parent},
        })
    if municipalities:
        print(f"  census dwellings with internet, first municipality {municipalities[0][1]} {municipalities[0][3]:.1f}%")
    return municipalities, features


if __name__ == "__main__":
    main()

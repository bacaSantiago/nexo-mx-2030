"""Build migration 0003 from official ENDUTIH series and the 2025 open microdata.

Point estimates already published stay as published. This script only adds
design-based standard errors when the microdata reproduce that figure to 1 decimal,
schooling cuts that the presentations do not publish, and a precomputed scenario
grid. It does not impute income and it does not fit a municipal model.
"""

from __future__ import annotations

import csv
import json
import math
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP = Path("/tmp/nexo-src/endutih2025.zip")
OUT = ROOT / "drizzle/migrations/0003_scenarios_scores_precision.sql"

Z90 = 1.6448536269514722
USERS_M = 104.9
NONBUYERS_M = 65.8
VAB_MXN_M = 2_308_458  # VABCOEL 2024, millones de pesos
BUY_2024 = 35.8
BUY_2025 = 37.3
VERSION = "2026-10-14"
SCENARIO_VERSION = "difusion-v1"

# Published purchase share among internet users. Sources are named in the migration.
PURCHASE_SERIES = [
    (2019, 22.1),  # ENDUTIH 2020 bulletin
    (2020, 27.7),
    (2022, 30.6),  # ENDUTIH 2023 presentation (paired with 2023)
    (2023, 33.4),  # ENDUTIH 2023 and 2024 presentations
    (2024, 35.8),  # ENDUTIH 2024 presentation, explicit sentence
    (2025, 37.3),  # ENDUTIH 2025 presentation, already seeded
]

SCHOOL_LABEL = {
    "00": "Ninguno",
    "01": "Preescolar",
    "02": "Primaria",
    "03": "Secundaria",
    "04": "Normal básica",
    "05": "Técnico con secundaria",
    "06": "Preparatoria o bachillerato",
    "07": "Técnico superior",
    "08": "Licenciatura o ingeniería",
    "09": "Especialidad",
    "10": "Maestría",
    "11": "Doctorado",
    "99": "No especificado",
}

# Published 2025 figures this script may attach an SE to. Values are the seeded estimates.
PUBLISHED = {
    ("internet_users_pct", "00", ""): 86.1,
    ("internet_users_pct", "00", "sex=Hombres"): 86.6,
    ("internet_users_pct", "00", "sex=Mujeres"): 85.6,
    ("internet_users_pct", "00", "area=Urbano"): 88.9,
    ("internet_users_pct", "00", "area=Rural"): 75.2,
    ("internet_use_type_pct", "00", "use_type=Comprar productos o servicios"): 37.3,
    ("internet_use_type_pct", "00", "area=Rural|use_type=Comprar productos o servicios"): 20.2,
    ("internet_use_type_pct", "00", "area=Urbano|use_type=Comprar productos o servicios"): 41.1,
    ("households_with_internet_pct", "00", ""): 78.3,
}


def logistic(t: float, K: float, r: float, t0: float) -> float:
    return K / (1.0 + math.exp(-r * (t - t0)))


def fit_logistic() -> tuple[float, float, float, float]:
    best: tuple[float, float, float, float] | None = None
    for K in [x * 1.0 for x in range(45, 96)]:
        for r_i in range(2, 80):
            r = r_i / 100
            for t0 in range(2008, 2026):
                sse = 0.0
                for year, y in PURCHASE_SERIES:
                    err = logistic(year, K, r, t0) - y
                    sse += err * err
                if best is None or sse < best[0]:
                    best = (sse, K, r, float(t0))
    assert best is not None
    sse, K, r, t0 = best
    # one-decimal local polish
    for K2 in (K - 0.5, K, K + 0.5):
        for r2 in (r - 0.005, r, r + 0.005):
            for t2 in (t0 - 0.5, t0, t0 + 0.5):
                if K2 <= BUY_2025 or r2 <= 0:
                    continue
                sse = sum((logistic(year, K2, r2, t2) - y) ** 2 for year, y in PURCHASE_SERIES)
                if sse < best[0]:
                    best = (sse, K2, r2, t2)
    sse, K, r, t0 = best
    dof = max(len(PURCHASE_SERIES) - 3, 1)
    sigma = math.sqrt(sse / dof)
    return K, r, t0, sigma


def taylor(rows: list[tuple[str, str, float, float, float]]) -> tuple[float, float, float] | None:
    """Taylor linearization of a ratio. rows: stratum, psu, weight, numerator indicator, denominator indicator."""
    num = den = 0.0
    clusters: dict[tuple[str, str], list[float]] = defaultdict(lambda: [0.0, 0.0])
    for h, psu, w, y, x in rows:
        if w <= 0 or x == 0 or not h or not psu:
            continue
        num += w * y
        den += w * x
        cell = clusters[(h, psu)]
        cell[0] += w * y
        cell[1] += w * x
    if den <= 0:
        return None
    p = num / den
    by_h: dict[str, list[float]] = defaultdict(list)
    for (h, _psu), (wy, wx) in clusters.items():
        by_h[h].append(wy - p * wx)
    var = 0.0
    for zs in by_h.values():
        n_h = len(zs)
        if n_h < 2:
            continue
        mean = sum(zs) / n_h
        var += (n_h / (n_h - 1.0)) * sum((z - mean) ** 2 for z in zs)
    # Variance of the ratio is the cluster residual variance divided by X^2.
    return p, math.sqrt(max(var, 0.0)) / den, den


def flag(cv: float) -> str:
    if cv < 15:
        return "high"
    if cv < 30:
        return "moderate"
    return "low"


def q(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def seg_key(obj: dict[str, str]) -> str:
    if not obj:
        return ""
    return "|".join(f"{k}={v}" for k, v in sorted(obj.items()))


def load_person_rows() -> list[dict[str, str]]:
    z = zipfile.ZipFile(ZIP)
    with z.open("conjunto_de_datos/tr_endutih_usuarios_anual_2025.csv") as fh:
        return list(csv.DictReader((line.decode("utf-8-sig") for line in fh)))


def load_household_rows() -> list[dict[str, str]]:
    z = zipfile.ZipFile(ZIP)
    with z.open("conjunto_de_datos/tr_endutih_hogares_anual_2025.csv") as fh:
        return list(csv.DictReader((line.decode("utf-8-sig") for line in fh)))


def age_label(age: int) -> str | None:
    bins = [
        (6, 14, "6 a 14 años"),
        (15, 24, "15 a 24 años"),
        (25, 34, "25 a 34 años"),
        (35, 44, "35 a 44 años"),
        (45, 54, "45 a 54 años"),
        (55, 64, "55 a 64 años"),
        (65, 74, "65 a 74 años"),
        (75, 97, "75 años y más"),
    ]
    for a, b, label in bins:
        if a <= age <= b:
            return label
    return None


def main() -> None:
    K, r, t0, sigma = fit_logistic()
    print(f"logistic K={K:.2f} r={r:.4f} t0={t0:.2f} sigma={sigma:.3f}")
    for year, y in PURCHASE_SERIES:
        print(f"  fit {year}: obs {y} pred {logistic(year, K, r, t0):.2f}")
    f2025 = logistic(2025, K, r, t0)

    def s0_path(year: int, ritmo: float) -> float:
        inc = logistic(year, K, r, t0) - f2025
        return min(95.0, max(0.0, BUY_2025 + ritmo * inc))

    people = load_person_rows()
    users = [row for row in people if row["P7_1"] == "1"]
    rural_users = sum(float(row["FAC_PER"]) for row in users if row["DOMINIO"] == "R")
    all_users_w = sum(float(row["FAC_PER"]) for row in users)
    rural_share = rural_users / all_users_w
    print(f"rural user share {rural_share:.4f} users_m {all_users_w/1e6:.2f}")

    skills_pp = 11.5 / 100 * NONBUYERS_M / USERS_M * 100
    trust_pp = 5.2 / 100 * NONBUYERS_M / USERS_M * 100
    print(f"skills pool {skills_pp:.3f} pp; trust pool {trust_pp:.3f} pp")

    # --- microdata estimates ---
    def person_tuples(pred) -> list[tuple[str, str, float, float, float]]:
        out = []
        for row in people:
            ok, y, x = pred(row)
            if not ok:
                continue
            out.append((row["EST_DIS"], row["UPM_DIS"], float(row["FAC_PER"]), y, x))
        return out

    estimates: list[dict] = []

    def add_ratio(metric: str, geo: str, segment: dict[str, str], pred, universe: str, published: float | None):
        stats = taylor(person_tuples(pred) if metric != "households_with_internet_pct" else [])
        return stats

    # Build design groups for persons
    groups: list[tuple[str, str, dict[str, str], str, object]] = []

    def keep_age(row: dict[str, str]) -> int | None:
        try:
            age = int(row["EDAD"])
        except ValueError:
            return None
        if age < 6 or age > 97:
            return None
        return age

    groups.append(("internet_users_pct", "00", {}, "Población de 6 años y más (persona seleccionada, factor FAC_PER)", lambda row: keep_age(row) is not None and (1.0 if row["P7_1"] == "1" else 0.0, 1.0)))
    groups.append(("internet_users_pct", "00", {"sex": "Hombres"}, "Población de 6 años y más, hombres", lambda row: keep_age(row) is not None and row["SEXO"] == "1" and (1.0 if row["P7_1"] == "1" else 0.0, 1.0)))
    groups.append(("internet_users_pct", "00", {"sex": "Mujeres"}, "Población de 6 años y más, mujeres", lambda row: keep_age(row) is not None and row["SEXO"] == "2" and (1.0 if row["P7_1"] == "1" else 0.0, 1.0)))
    groups.append(("internet_users_pct", "00", {"area": "Urbano"}, "Población de 6 años y más, ámbito urbano", lambda row: keep_age(row) is not None and row["DOMINIO"] == "U" and (1.0 if row["P7_1"] == "1" else 0.0, 1.0)))
    groups.append(("internet_users_pct", "00", {"area": "Rural"}, "Población de 6 años y más, ámbito rural", lambda row: keep_age(row) is not None and row["DOMINIO"] == "R" and (1.0 if row["P7_1"] == "1" else 0.0, 1.0)))

    for code, label in SCHOOL_LABEL.items():
        groups.append((
            "internet_users_pct",
            "00",
            {"schooling": label},
            "Población de 6 años y más con nivel de escolaridad declarado en el cuestionario ENDUTIH (NIVEL)",
            lambda row, code=code: keep_age(row) is not None and row["NIVEL"].zfill(2) == code and (1.0 if row["P7_1"] == "1" else 0.0, 1.0),
        ))

    # purchase among internet users
    def buyer(row: dict[str, str], extra=lambda _r: True):
        if row["P7_1"] != "1" or keep_age(row) is None or not extra(row):
            return None
        return (1.0 if row["P7_21"] == "1" else 0.0, 1.0)

    groups.append(("internet_use_type_pct", "00", {"use_type": "Comprar productos o servicios"}, "Personas usuarias de internet", lambda row: buyer(row)))
    groups.append(("internet_use_type_pct", "00", {"area": "Urbano", "use_type": "Comprar productos o servicios"}, "Personas usuarias de internet, ámbito urbano", lambda row: buyer(row, lambda r: r["DOMINIO"] == "U")))
    groups.append(("internet_use_type_pct", "00", {"area": "Rural", "use_type": "Comprar productos o servicios"}, "Personas usuarias de internet, ámbito rural", lambda row: buyer(row, lambda r: r["DOMINIO"] == "R")))
    for code, label in SCHOOL_LABEL.items():
        groups.append((
            "internet_use_type_pct",
            "00",
            {"schooling": label, "use_type": "Comprar productos o servicios"},
            "Personas usuarias de internet, según escolaridad",
            lambda row, code=code: buyer(row, lambda r: r["NIVEL"].zfill(2) == code),
        ))

    # states
    for ent in [f"{i:02d}" for i in range(1, 33)]:
        groups.append((
            "internet_users_pct",
            ent,
            {},
            "Población de 6 años y más de la entidad",
            lambda row, ent=ent: keep_age(row) is not None and row["CVE_ENT"].zfill(2) == ent and (1.0 if row["P7_1"] == "1" else 0.0, 1.0),
        ))

    computed = []
    for metric, geo, segment, universe, pred in groups:
        raw_rows = []
        for row in people:
            got = pred(row)
            if not isinstance(got, tuple):
                continue
            y, x = got
            if x == 0:
                continue
            raw_rows.append((row["EST_DIS"], row["UPM_DIS"], float(row["FAC_PER"]), y, x))
        stats = taylor(raw_rows)
        if not stats:
            continue
        p, se, den = stats
        pct = p * 100
        se_pp = se * 100
        computed.append({
            "metric": metric,
            "geo": geo,
            "segment": segment,
            "key": seg_key(segment),
            "universe": universe,
            "pct": pct,
            "se": se_pp,
            "den": den,
        })

    # households
    homes = load_household_rows()
    home_groups = [( "00", {}, lambda row: True )]
    for ent in [f"{i:02d}" for i in range(1, 33)]:
        home_groups.append((ent, {}, lambda row, ent=ent: row["CVE_ENT"].zfill(2) == ent))
    for geo, segment, pred in home_groups:
        raw_rows = []
        for row in homes:
            if not pred(row):
                continue
            if row["P4_4"] not in ("1", "2"):
                continue
            raw_rows.append((row["EST_DIS"], row["UPM_DIS"], float(row["FAC_HOG"]), 1.0 if row["P4_4"] == "1" else 0.0, 1.0))
        stats = taylor(raw_rows)
        if not stats:
            continue
        p, se, den = stats
        computed.append({
            "metric": "households_with_internet_pct",
            "geo": geo,
            "segment": segment,
            "key": seg_key(segment),
            "universe": "Total de hogares",
            "pct": p * 100,
            "se": se * 100,
            "den": den,
        })

    print("\nValidation against published 1-decimal figures:")
    for row in computed:
        pub = PUBLISHED.get((row["metric"], row["geo"], row["key"]))
        if pub is None and row["geo"] != "00" and row["metric"] == "internet_users_pct" and row["key"] == "":
            continue
        if pub is None:
            continue
        mark = "OK" if abs(row["pct"] - pub) < 0.055 else "DIFF"
        print(f"  {mark} {row['metric']} {row['geo']} {row['key'] or 'total'}: micro {row['pct']:.2f} published {pub} se {row['se']:.3f}")

    # state published list from the seed, duplicated here so the script stays standalone
    state_users = {
        "01": 91.1, "02": 93.2, "03": 91.1, "04": 83.6, "05": 86.3, "06": 89.6, "07": 71.2, "08": 88.8,
        "09": 92.0, "10": 86.0, "11": 85.4, "12": 81.4, "13": 85.3, "14": 88.5, "15": 85.4, "16": 85.1,
        "17": 82.8, "18": 90.1, "19": 93.9, "20": 78.6, "21": 84.4, "22": 88.7, "23": 92.1, "24": 84.0,
        "25": 88.7, "26": 88.8, "27": 84.6, "28": 87.6, "29": 85.2, "30": 81.8, "31": 84.3, "32": 85.9,
    }
    state_hh = {
        "01": 86.0, "02": 89.1, "03": 83.6, "04": 76.3, "05": 81.3, "06": 81.4, "07": 53.9, "08": 79.7,
        "09": 90.5, "10": 73.4, "11": 79.2, "12": 70.0, "13": 73.3, "14": 84.8, "15": 80.2, "16": 73.1,
        "17": 74.4, "18": 76.1, "19": 89.9, "20": 64.0, "21": 70.9, "22": 84.9, "23": 87.2, "24": 72.7,
        "25": 81.2, "26": 84.3, "27": 78.8, "28": 77.0, "29": 72.0, "30": 68.3, "31": 80.0, "32": 80.1,
    }
    for geo, pub in state_users.items():
        PUBLISHED[("internet_users_pct", geo, "")] = pub
    for geo, pub in state_hh.items():
        PUBLISHED[("households_with_internet_pct", geo, "")] = pub

    updates = []
    inserts = []
    for row in computed:
        pub = PUBLISHED.get((row["metric"], row["geo"], row["key"]))
        se = row["se"]
        if se <= 0 or not math.isfinite(se):
            continue
        center = pub if pub is not None and abs(row["pct"] - pub) < 0.055 else None
        if center is None and "schooling" in row["segment"]:
            center = round(row["pct"], 1)
            new_row = True
        elif center is None:
            if pub is not None:
                print(f"  skip SE {row['metric']} {row['geo']} {row['key']}: micro {row['pct']:.2f} != {pub}")
            continue
        else:
            new_row = "schooling" in row["segment"]
        cv = se / center * 100 if center else None
        if cv is None or not math.isfinite(cv):
            continue
        lo = max(0.0, center - Z90 * se)
        hi = min(100.0, center + Z90 * se)
        payload = {**row, "center": center, "cv": cv, "lo": lo, "hi": hi, "flag": flag(cv), "new": new_row}
        if new_row:
            inserts.append(payload)
        else:
            updates.append(payload)

    print(f"\nSE updates {len(updates)} new schooling rows {len(inserts)}")

    # --- scenarios ---
    def band(est: float, year: int) -> tuple[float, float]:
        horizon = 1.0 + (year - 2025) / 5.0
        half = 1.2815515655446004 * sigma * math.sqrt(horizon)
        return max(0.0, est - half), min(100.0, est + half)

    scenarios = {
        "s0": {"param": "ritmo", "grid": [0.8, 1.0, 1.2]},
        "s1": {"param": "alivio_habilidades", "grid": [0, 25, 50]},
        "s2": {"param": "alivio_confianza", "grid": [0, 20, 40]},
        "s3": {"param": "cierre_brecha", "grid": [0, 5, 10]},
    }

    def adoption(code: str, year: int, value: float) -> float:
        base = s0_path(year, 1.0)
        phase = (year - 2025) / 5.0
        if code == "s0":
            return s0_path(year, value)
        if code == "s1":
            return min(95.0, base + skills_pp * (value / 100.0) * phase)
        if code == "s2":
            return min(95.0, base + trust_pp * (value / 100.0) * phase)
        return min(95.0, base + rural_share * value * phase)

    scenario_rows = []
    for code, spec in scenarios.items():
        for value in spec["grid"]:
            assumptions = {spec["param"]: value}
            for year in range(2025, 2031):
                est = adoption(code, year, value)
                p10, p90 = band(est, year)
                base = adoption("s0", year, 1.0)
                extra_buyers = (est - base) / 100.0 * USERS_M * 1_000_000
                b10 = (p10 - base) / 100.0 * USERS_M * 1_000_000
                b90 = (p90 - base) / 100.0 * USERS_M * 1_000_000
                gap = 0.0 if code != "s3" else value * (year - 2025) / 5.0
                delta = est / BUY_2024 - 1.0
                econ = VAB_MXN_M * max(delta, 0.0)
                scenario_rows.append((code, "scenario_adoption_pct", year, est, p10, p90, "percent", "", assumptions))
                scenario_rows.append((code, "scenario_additional_buyers", year, extra_buyers, b10, b90, "persons", "", assumptions))
                scenario_rows.append((code, "scenario_gap_reduction_pp", year, gap, None, None, "percentage_points", "", assumptions))
                scenario_rows.append((code, "scenario_economic_impact_mxn", year, econ * 0.75, econ * 0.50, econ * 1.0, "mxn_millions", "", assumptions))
            # waterfall at 2030: components sum to the gain vs the 2025 anchor
            gain_base = adoption("s0", 2030, 1.0) - BUY_2025
            total = adoption(code, 2030, value) - BUY_2025
            parts = [("Inercial", gain_base if code != "s0" else total)]
            if code == "s1":
                parts.append(("Habilidades", total - gain_base))
            elif code == "s2":
                parts.append(("Confianza", total - gain_base))
            elif code == "s3":
                parts.append(("Brecha rural", total - gain_base))
            for label, pp in parts:
                scenario_rows.append((code, "scenario_contribution_pp", 2030, pp, None, None, "percentage_points", label, assumptions))

    print(f"scenario rows {len(scenario_rows)}")
    print("2030 adoption at defaults:")
    for code, value in (("s0", 1.0), ("s1", 25), ("s2", 20), ("s3", 5)):
        print(f"  {code} {adoption(code, 2030, value):.2f}")

    # intervention scores on 0–1 so the existing bars and product score work
    offline = (1 - 0.861) * (USERS_M / 0.861) * 1_000_000
    addressable = {
        "nexo_acceso": offline,
        "nexo_habil": 0.115 * NONBUYERS_M * 1_000_000,
        "nexo_pago": 0.019 * NONBUYERS_M * 1_000_000,
        "nexo_confianza": 0.052 * NONBUYERS_M * 1_000_000,
        "nexo_comercio": 0.215 * NONBUYERS_M * 1_000_000,
        "nexo_territorio": rural_share * USERS_M * 1_000_000 * (1 - 0.202),
        "nexo_inclusivo": None,  # filled from microdata 75+
    }
    old = [row for row in people if keep_age(row) is not None and int(row["EDAD"]) >= 75]
    old_w = sum(float(row["FAC_PER"]) for row in old)
    old_off = sum(float(row["FAC_PER"]) for row in old if row["P7_1"] != "1")
    addressable["nexo_inclusivo"] = old_off
    print(f"age 75+ million {old_w/1e6:.2f} offline {old_off/1e6:.2f}")

    reach = {
        "nexo_acceso": 1 - 0.861,
        "nexo_habil": 0.115,
        "nexo_pago": 0.019,
        "nexo_confianza": 0.052,
        "nexo_comercio": 0.215,
        "nexo_territorio": 1 - 0.202,
        "nexo_inclusivo": old_off / old_w,
    }
    # Equity is the module's published gap divided by 50 pp, so 50 pp maps to 1.
    equity = {
        "nexo_acceso": (88.9 - 75.2) / 50,          # brecha urbano-rural de uso de internet
        "nexo_habil": (86.1 - 57.8) / 50,          # rezago 65–74 frente al total
        "nexo_pago": 21.7 / 50,                    # brecha urbano-rural de pagos por internet
        "nexo_confianza": 5.2 / 50,                # razón «desconfía de la seguridad», sin cruce de grupo
        "nexo_comercio": 20.9 / 50,                # brecha urbano-rural de compra
        "nexo_territorio": 20.9 / 50,
        "nexo_inclusivo": min(1.0, (86.1 - 30.3) / 50),
    }
    feasibility = {
        "nexo_acceso": 3 / 5, "nexo_habil": 4 / 5, "nexo_pago": 3 / 5, "nexo_confianza": 4 / 5,
        "nexo_comercio": 3 / 5, "nexo_territorio": 2 / 5, "nexo_inclusivo": 4 / 5,
    }
    cost = {
        "nexo_acceso": 4 / 5, "nexo_habil": 2 / 5, "nexo_pago": 3 / 5, "nexo_confianza": 2 / 5,
        "nexo_comercio": 3 / 5, "nexo_territorio": 5 / 5, "nexo_inclusivo": 2 / 5,
    }

    def people_label(n: float) -> str:
        return f"{int(round(n)):,}".replace(",", " ") + " personas"

    sql: list[str] = []
    sql.append("-- Generated by scripts/build_reviewed_load.py. Do not edit by hand.")
    sql.append("-- Scenario grid, intervention scores, and ENDUTIH 2025 design-based precision/schooling.")
    sql.append("begin;")

    sql.append("""
update public.scenario_definition set
  description = 'Continuidad de la logística ajustada a la serie oficial de compra entre personas usuarias (2019, 2020, 2022–2025). El año 2025 queda anclado en 37.3 %. El deslizador solo recorre el ritmo aprobado 0.8–1.2.',
  assumptions = '{"parameters":[{"key":"ritmo","label":"Ritmo de difusión","min":0.8,"max":1.2,"step":0.05,"default":1}]}'::jsonb
where scenario_code = 's0';

update public.scenario_definition set
  description = 'Parte del escenario inercial y suma, hacia 2030, una fracción del grupo que declaró «No sabe cómo hacerlo» (11.5 % de las personas usuarias que no compraron). No suma otras razones: la respuesta es múltiple.',
  assumptions = '{"parameters":[{"key":"alivio_habilidades","label":"Alivio de la barrera de habilidades","unit":"%","min":0,"max":50,"step":5,"default":25}]}'::jsonb
where scenario_code = 's1';

update public.scenario_definition set
  description = 'Parte del escenario inercial y suma, hacia 2030, una fracción de quienes declararon «Desconfía de la seguridad» (5.2 % de quienes no compraron). No se le suma la falta de tarjeta, para no contar dos veces la misma respuesta múltiple.',
  assumptions = '{"parameters":[{"key":"alivio_confianza","label":"Alivio de la barrera de confianza","unit":"%","min":0,"max":40,"step":5,"default":20}]}'::jsonb
where scenario_code = 's2';

update public.scenario_definition set
  description = 'Cierra hasta 10 puntos de la brecha urbano-rural de compra (20.9 pp en 2025) y traslada ese cierre al promedio nacional con el peso de personas usuarias rurales del microdato ENDUTIH 2025. No suma otras barreras.',
  assumptions = '{"parameters":[{"key":"cierre_brecha","label":"Cierre de brecha rural de compra","unit":"pp","min":0,"max":10,"step":1,"default":5}]}'::jsonb
where scenario_code = 's3';

update public.dim_metric set status = 'modeled'
where metric_code like 'scenario_%';
""")

    sql.append("insert into public.scenario_result (scenario_code, metric_code, reference_year, geo_level, geo_code, segment_code, component_code, estimate, p10, p50, p90, unit, observed_or_modeled, assumptions_version, assumption_values) values")
    values = []
    for code, metric, year, est, p10, p90, unit, component, assumptions in scenario_rows:
        p10s = "null" if p10 is None else f"{p10:.6f}"
        p90s = "null" if p90 is None else f"{p90:.6f}"
        p50s = "null" if p10 is None else f"{est:.6f}"
        values.append(
            f"({q(code)},{q(metric)},{year},'national','00','',{q(component)},{est:.6f},{p10s},{p50s},{p90s},{q(unit)},'scenario',{q(SCENARIO_VERSION)},{q(json.dumps(assumptions, separators=(',', ':')))}::jsonb)"
        )
    sql.append(",\n".join(values) + ";")

    sql.append(f"""
insert into public.source_lineage(fact_table, fact_id, source_id, source_page, source_url, transformation, loaded_version)
select 'scenario_result', r.id, s.id, null, s.official_url,
  'Logística anclada en 37.3 % (2025). Parámetros K={K:.1f}, r={r:.3f}, t0={t0:.1f}; sigma residual {sigma:.2f} pp. Banda p10–p90 = 1.28 sigma con horizonte. Compradores adicionales sobre 104.9 millones de usuarias de 2025, sin proyección demográfica. Impacto económico: VABCOEL 2024 (2 308 458 millones) por (adopción/35.8 - 1), con elasticidad 0.5 / 0.75 / 1.0; no es multiplicador MIP ni ventas. Alivio de habilidades = fracción de 11.5 % de 65.8 millones. Confianza = fracción de 5.2 %. Brecha rural = puntos cerrados por el peso rural de usuarias ({rural_share:.4f}).',
  {q(SCENARIO_VERSION)}
from public.scenario_result r
join public.source_document s on s.source_code = 'endutih_2025_presentation'
where r.assumptions_version = {q(SCENARIO_VERSION)};
""")

    # scores + kpis
    kpi_names = {
        "nexo_acceso": "Personas habilitadas para conectarse",
        "nexo_habil": "Primera compra completada",
        "nexo_pago": "Pago digital activado",
        "nexo_confianza": "Compra con protección de primera compra",
        "nexo_comercio": "Comercios con kit activo",
        "nexo_territorio": "Entregas en nodo de recolección",
        "nexo_inclusivo": "Primera conexión en el grupo de 75 años y más",
    }
    for code, people_n in addressable.items():
        assert people_n is not None
        uplift_pp = 0.25 * people_n / (USERS_M * 1_000_000) * 100
        uplift = min(0.99, uplift_pp / 10.0)
        rc, mu, eq, fe, co = reach[code], uplift, equity[code], feasibility[code], cost[code]
        priority = (rc ** 1 * mu ** 1 * eq ** 1 * fe ** 1) / co ** 1
        kpis = json.dumps([{
            "kpi": kpi_names[code],
            "m3": people_label(people_n * 0.0005),
            "m6": people_label(people_n * 0.0015),
            "m12": people_label(people_n * 0.004),
        }], ensure_ascii=False)
        sql.append(
            f"update public.intervention set kpis = {q(kpis)}::jsonb where intervention_code = {q(code)};"
        )
        sql.append(
            "insert into public.intervention_score (intervention_code, geo_level, geo_code, reach, modeled_uplift, equity, feasibility, relative_cost, priority_score, observed_or_modeled, model_version) values ("
            f"{q(code)},'national','00',{rc:.6f},{mu:.6f},{eq:.6f},{fe:.6f},{co:.6f},{priority:.6f},'modeled','puentes-v1')"
            " on conflict do nothing;"
        )
        print(f"score {code}: reach {rc:.3f} uplift {mu:.3f} equity {eq:.3f} feas {fe:.2f} cost {co:.2f} priority {priority:.5f} pool {people_n/1e6:.2f}M")

    sql.append("""
insert into public.source_lineage(fact_table, fact_id, source_id, source_page, source_url, transformation, loaded_version)
select 'intervention_score', s.id, d.id, null, d.official_url,
  'Alcance = tasa publicada de la barrera en su universo (0 a 1). Impacto = 25 % de ese grupo como compradoras adicionales, dividido entre 10 pp. Equidad = brecha oficial relativa del módulo. Factibilidad y costo son rúbrica ordinal 1 a 5 dividida entre 5 (juicio de diseño, no encuesta). Metas 3/6/12 meses = 0.05 % / 0.15 % / 0.40 % del grupo publicado.',
  'puentes-v1'
from public.intervention_score s
join public.source_document d on d.source_code = 'endutih_2025_presentation'
where s.model_version = 'puentes-v1';
""")

    note_se = (
        "Error estándar por linealización de Taylor con FAC_PER o FAC_HOG, estrato EST_DIS y UPM UPM_DIS. "
        "Intervalo al 90 %, como el tabulado oficial de precisión. El punto que ya estaba publicado no se reemplaza; "
        "solo se llena el error cuando el microdato reproduce ese punto a un decimal."
    )
    for row in updates:
        geo_level = "national" if row["geo"] == "00" else "state"
        sql.append(
            "update public.fact_estimate set "
            f"standard_error = {row['se']:.6f}, ci_low = {row['lo']:.6f}, ci_high = {row['hi']:.6f}, "
            f"confidence_level = 0.90, cv = {row['cv']:.6f}, precision_flag = {q(row['flag'])}, "
            f"method_id = (select id from public.dim_method where method_code = 'survey_design_estimate'), "
            f"note = concat_ws(' ', note, {q(note_se)}) "
            f"where metric_code = {q(row['metric'])} and reference_year = 2025 and geo_level = {q(geo_level)} "
            f"and geo_code = {q(row['geo'])} and segment_key = {q(row['key'])} and version = '2026-10-13';"
        )

    if inserts:
        sql.append(
            "insert into public.fact_estimate (metric_code, reference_year, source_id, universe, geo_level, geo_code, segment_json, segment_key, estimate, unit, standard_error, ci_low, ci_high, confidence_level, cv, precision_flag, observed_or_modeled, method_id, version, source_page, source_url, note) values"
        )
        vals = []
        src = "https://www.inegi.org.mx/contenidos/programas/endutih/2025/datosabiertos/conjunto_de_datos_endutih_2025_csv.zip"
        for row in inserts:
            seg = json.dumps(row["segment"], ensure_ascii=False, separators=(",", ":"))
            note = (
                "Estimación directa del conjunto de datos abiertos ENDUTIH 2025 (persona seleccionada, FAC_PER, variable NIVEL). "
                "Este cruce no está en la presentación de resultados. Error estándar por linealización de Taylor con estrato EST_DIS y UPM UPM_DIS. Intervalo al 90 %."
            )
            vals.append(
                f"({q(row['metric'])},2025,(select id from public.source_document where source_code='endutih_2025'),"
                f"{q(row['universe'])},'national','00',{q(seg)}::jsonb,{q(row['key'])},{row['center']:.1f},'percent',"
                f"{row['se']:.6f},{row['lo']:.6f},{row['hi']:.6f},0.90,{row['cv']:.6f},{q(row['flag'])},'observed',"
                f"(select id from public.dim_method where method_code='survey_design_estimate'),{q(VERSION)},null,{q(src)},{q(note)})"
            )
        sql.append(",\n".join(vals) + ";")
        sql.append(f"""
insert into public.dim_segment(segment_code, dimension, value, label)
select distinct lower(regexp_replace(k||'_'||v,'[^a-zA-Z0-9]+','_','g')), k, v, v
from public.fact_estimate, jsonb_each_text(segment_json) e(k,v)
where version = {q(VERSION)}
on conflict do nothing;

insert into public.source_lineage(fact_table, fact_id, source_id, source_page, source_url, transformation, loaded_version)
select 'fact_estimate', id, source_id, source_page, source_url,
  'Razón de totales expandidos con linealización de Taylor (EST_DIS, UPM_DIS). Escolaridad = NIVEL del cuestionario.',
  version
from public.fact_estimate where version = {q(VERSION)};
""")

    sql.append(f"""
insert into public.methodology_note(note_code, title, body, topic, source_id) values
('scenario_grid_v1','Malla de escenarios 2030',
 'La adopción de compra entre personas usuarias sigue una logística ajustada a 2019 (22.1 %), 2020 (27.7 %), 2022 (30.6 %), 2023 (33.4 %), 2024 (35.8 %) y 2025 (37.3 %). 2025 queda fijo en el dato publicado. p10 y p90 salen del residual del ajuste, no de un error de muestreo. Los alivios de habilidades y confianza convierten una sola razón publicada, sin sumar respuestas múltiples. El cierre rural usa el peso de personas usuarias rurales del microdato. El impacto en pesos escala el VABCOEL 2024 con una elasticidad no identificada de 0.5 a 1; no es un multiplicador de la matriz insumo-producto.',
 'scenario', (select id from public.source_document where source_code='endutih_2025_presentation')),
('schooling_precision_v1','Escolaridad y precisión 2025',
 'La escolaridad sale del microdato abierto ENDUTIH 2025 (variable NIVEL, factor FAC_PER), porque la presentación no publica ese cruce. El error estándar usa estrato y UPM. El ingreso imputado sigue pendiente: el estrato socioeconómico de ENDUTIH no es un decil de ENIGH y no se hizo el emparejamiento.',
 'precision', (select id from public.source_document where source_code='endutih_2025')),
('intervention_rubric_v1','Rúbrica de Puentes NEXO',
 'Alcance, impacto y equidad salen de tasas ENDUTIH 2025. Factibilidad y costo relativo son una rúbrica ordinal de diseño (1 a 5), guardada en escala 0 a 1. Las metas de 3, 6 y 12 meses son 0.05 %, 0.15 % y 0.40 % del grupo publicado: son metas de piloto, no un resultado observado.',
 'intervention', (select id from public.source_document where source_code='endutih_2025_presentation'))
on conflict (note_code) do update set body = excluded.body, title = excluded.title;
""")

    sql.append("commit;")
    OUT.write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

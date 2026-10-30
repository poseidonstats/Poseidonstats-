"""Scor90 strict, comun training/decontare/site (audit 30 octombrie 2026).

Nu ghicește scorul de 90 dintr-un total AET/PEN sau dintr-o pereche incompletă.
Fără dovadă consistentă întoarce None (carantină). Nu modifică rândul sursă.
"""

from __future__ import annotations

import math
from collections.abc import Mapping


def _gol(value) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (ValueError, TypeError):
        return None
    if not math.isfinite(number) or number < 0 or not number.is_integer():
        return None
    return int(number)


def _lipsa(value) -> bool:
    if value is None:
        return True
    try:
        return math.isnan(float(value))
    except (TypeError, ValueError):
        return False


def scor_90(row: Mapping) -> tuple[int, int] | None:
    """FT: fallback goals numai dacă ambele fulltime lipsesc; AET/PEN: dovadă ET.

    La AET, ET 0-0 rămâne ambigu fără dovadă externă. La PEN, o pereche
    ET 0-0 explicită este admisă dacă fulltime și totalul sunt coerente; ET
    lipsă rămâne necunoscut. Nu impunem egal la 90′ pentru meciurile tur-retur.
    """
    r = dict(row)
    status = r.get("status_short", r.get("status"))
    if status not in ("FT", "AET", "PEN"):
        return None
    raw_ft = (r.get("fulltime_home"), r.get("fulltime_away"))
    ft = tuple(_gol(v) for v in raw_ft)
    goals = tuple(_gol(r.get(f"goals_{side}")) for side in ("home", "away"))
    if None in ft:
        if status == "FT" and all(_lipsa(v) for v in raw_ft) and None not in goals:
            ft = goals
        else:
            return None
    if status == "FT":
        et = tuple(_gol(r.get(f"extratime_{side}")) for side in ("home", "away"))
        if any(value is not None and value > 0 for value in et):
            return None
        raw_goals = (r.get("goals_home"), r.get("goals_away"))
        if not all(_lipsa(v) for v in raw_goals) and goals != ft:
            return None
    else:
        et = tuple(_gol(r.get(f"extratime_{side}")) for side in ("home", "away"))
        if None in goals or None in et or (status == "AET" and et == (0, 0)):
            return None
        if goals != (ft[0] + et[0], ft[1] + et[1]):
            return None
    ht = tuple(_gol(r.get(f"halftime_{side}")) for side in ("home", "away"))
    if any(half is not None and half > final for half, final in zip(ht, ft)):
        return None
    return ft

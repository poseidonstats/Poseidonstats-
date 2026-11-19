"""Etichetele prezentării Pro. Nu sunt intrări pentru evaluarea sau selecția pronosticurilor."""

from __future__ import annotations

import html
import json
import re
from functools import lru_cache
from pathlib import Path

ALIASES = {
    "baza": (
        "Bază",
        "Baza",
        "Base",
        "Dasar",
        "Siguranță",
        "Sécurité",
        "Seguridad",
        "Sicurezza",
        "Safety",
        "Aman",
        "Keamanan",
        "Safe pick",
        "Safe",
        "Banker",
        "Core",
        "Foundation",
    ),
    "principal": ("Principal", "Main", "Main pick", "Principale", "Utama"),
    "curajos": (
        "Curajos",
        "Bold",
        "Bold pick",
        "Audacieux",
        "Berani",
        "Atrevido",
        "Audace",
        "Arriesgado",
        "Coraggioso",
        "Coraggiosa",
        "Audaz",
    ),
}
EMOJI_ROLE = {"🔒": "baza", "🎯": "principal", "💎": "curajos"}
ROLE_BY_NAME = {
    name.casefold(): role for role, names in ALIASES.items() for name in names
}
ROLE_PATTERN = "|".join(map(re.escape, sorted(ROLE_BY_NAME, key=len, reverse=True)))
ROLE_LEAD = re.compile(
    rf"^(?:[🔒🎯💎]\s*)?(?P<bold><strong>)?(?P<role>{ROLE_PATTERN})(?=\s*:)",
    re.I,
)
PICK_OMITTED = {
    "ro": [
        (r"fără pick curajos azi", "fără selecție alternativă azi"),
        (r"nicio piață de cotă", "nicio piață eligibilă"),
    ],
    "en": [
        (r"no bold pick today", "no alternative selection today"),
        (r"no odds market", "no eligible market"),
    ],
    "es": [
        (
            r"hoy (?:sin|no hay) pick (?:audaz|atrevido|arriesgado)",
            "hoy no hay selección alternativa",
        ),
        (
            r"sin pick (?:audaz|atrevido|arriesgado) hoy",
            "sin selección alternativa hoy",
        ),
        (r"ningún mercado de cuota", "ningún mercado elegible"),
        (
            r"no hay pick (?:audaz|atrevido|arriesgado) hoy",
            "no hay selección alternativa hoy",
        ),
    ],
    "it": [
        (
            r"nessun pick (?:audace|coraggioso) oggi",
            "nessuna selezione alternativa oggi",
        ),
        (r"nessun mercato di quota", "nessun mercato idoneo"),
    ],
    "fr": [
        (
            r"pas de pick audacieux aujourd'hui",
            "pas de sélection alternative aujourd’hui",
        ),
        (r"aucun marché de cote", "aucun marché éligible"),
    ],
    "id": [
        (r"tidak ada pick berani hari ini", "tidak ada pilihan alternatif hari ini"),
        (r"tidak ada pasar odds", "tidak ada pasar yang memenuhi syarat"),
    ],
}
ODDS_MARKER = (
    r"(?:(?:E |Este )?pick de cot[ăa]|Es un pick de cuota|È un pick di quota|"
    r"C(?:'|’|&#39;|&#x27;)est un pick de cote|"
    r"It(?:'|’|&#39;|&#x27;)s an odds pick|(?:An )?odds pick|"
    r"pick de cuota|pick di quota|pick de cote|pick harga)"
)
RISK_SUFFIX = (
    r"cu risc asumat|with (?:the risk accepted|accepted risk)|con riesgo asumido|"
    r"con rischio assunto|(?:avec (?:un )?|à )?risque assumé|"
    r"dengan risiko yang (?:disadari|diambil secara sadar)"
)
SAFETY_SUFFIX = (
    r"nu de siguranță|not a safety pick|no (?:pick )?de seguridad|pas un pick de sécurité|"
    r"non (?:pick )?di sicurezza|bukan pick (?:keamanan|aman)"
)
LEGACY_REASON = re.compile(
    rf"(?<!\w){ODDS_MARKER}(?P<risk>,\s*(?:{RISK_SUFFIX}|{SAFETY_SUFFIX}))?"
    r"(?:(?P<dot>\.(?!\d))|(?=\s*(?:[:,)—–*]|</(?:strong|em)>|$)))",
    re.I,
)
MARKET_LIST = re.compile(
    r'(data-i18n="arhiva\.sect\.piete"[^<]*</strong></p>\s*<ul>)(.*?)(</ul>)',
    re.S,
)
LANG_BLOCK = re.compile(r'<div data-lang="(ro|en|es|it|fr|id)"[^>]*>')
NO_PICKS = '<tr><td colspan="4">Analiza nu are pick-uri în formatul standard.</td></tr>'
NO_PICKS_LOCALIZED = (
    '<tr><td colspan="4" data-i18n="arhiva.fara.selectii">'
    "Analiza nu are selecții în formatul standard.</td></tr>"
)
LESSON_KEYS = {
    "arhiva.lectie.baza",
    "arhiva.lectie.principal",
    "arhiva.lectie.principal0",
    "arhiva.lectie.neev",
}


@lru_cache(maxsize=1)
def _dictionary() -> dict:
    return json.loads(
        (Path(__file__).resolve().parent.parent / "assets/i18n.json").read_text(
            encoding="utf-8"
        )
    )


def copy(key: str, lang: str) -> str:
    d = _dictionary()
    return d.get(lang, d["ro"])[key]


def lesson_copy(key: str, variables: dict, original: str) -> str:
    if key in LESSON_KEYS:
        return copy(key, "ro").format(**variables)
    return original


def role_badge(name: str, lang: str) -> str:
    role = ROLE_BY_NAME.get(name.casefold())
    if not role:
        return html.escape(name)
    key = "arhiva.rol." + role
    return (
        f'<span data-i18n="{key}" data-archive-role="{role}">'
        f"{html.escape(copy(key, lang))}</span>"
    )


def display_pick(markup: str, lang: str) -> str:
    """Schimbă numai prefixul de rol și propozițiile editoriale fixe, după parsarea sursei."""
    original_role = ROLE_LEAD.match(markup)
    if original_role:
        role = original_role["role"]
        badge = role_badge(role, lang)
        markup = (original_role["bold"] or "") + badge + markup[original_role.end() :]
    elif markup[:1] in EMOJI_ROLE:
        markup = markup[1:].lstrip()

    # Apostrofurile pot proveni din conținutul înghețat sau din escapingul HTML.
    for old, new in PICK_OMITTED.get(lang, ()):
        edited = old.replace("'", r"(?:'|’|&#39;|&#x27;)")
        markup = re.sub(r"(?<!\w)(?:" + edited + r")(?!\w)", new, markup, flags=re.I)

    def replace_reason(match: re.Match) -> str:
        label = copy(
            "arhiva.rol.risc" if match["risk"] else "arhiva.rol.alternativa", lang
        )
        if not match["dot"] and re.match(r"\s*[:,)—–*]", markup[match.end() :]):
            label = label.rstrip(".")
        return html.escape(label)

    return LEGACY_REASON.sub(replace_reason, markup)


def localize_frozen_archive(source: str) -> str:
    """Retușează doar ecranele de lectură. Niciun scor sau procent nu este recalculat."""

    def localize(segment: str, lang: str) -> str:
        def market_list(match: re.Match) -> str:
            items = re.sub(
                r"(<li[^>]*>)(.*?)(</li>)",
                lambda item: item[1] + display_pick(item[2], lang) + item[3],
                match[2],
                flags=re.S,
            )
            return match[1] + items + match[3]

        fragment = MARKET_LIST.sub(market_list, segment)
        fragment = re.sub(
            rf"(<tr><td>)({ROLE_PATTERN})(</td>)",
            lambda cell: cell[1] + role_badge(cell[2], lang) + cell[3],
            fragment,
            flags=re.I,
        )

        def localize_lesson(match: re.Match) -> str:
            variables = (
                json.loads(html.unescape(match["vars"])) if match["vars"] else {}
            )
            return (
                match["start"]
                + html.escape(lesson_copy(match["key"], variables, match["text"]))
                + "</span>"
            )

        fragment = re.sub(
            r"""(?P<start><span data-i18n="(?P<key>arhiva\.lectie\.(?:baza|principal0?|neev))"(?: data-i18n-vars='(?P<vars>[^']*)')?>)(?P<text>[^<]*)</span>""",
            localize_lesson,
            fragment,
        )
        return fragment.replace(NO_PICKS, NO_PICKS_LOCALIZED)

    parts = LANG_BLOCK.split(source)
    return localize(parts[0], "ro") + "".join(
        match[0] + localize(parts[index * 2 + 2], match[1])
        for index, match in enumerate(LANG_BLOCK.finditer(source))
    )

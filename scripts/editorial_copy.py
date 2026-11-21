"""Public wording for legacy references to the match-data provider."""

import re


_PROVIDER = r"\bapi[-‐‑–—\s]*football\b"
_PROVIDER_NAME = re.compile(_PROVIDER, re.IGNORECASE)
_DATABASE = (
    r"(?:baza\s+|the database\s+|the\s+(?=api)|la base de\s+|la base\s+|"
    r"il database\s+|database\s+|basis data\s+)?"
)
_DATA = {
    "ro": ("sezonul curent", "setul de date disponibil"),
    "en": ("current season", "the available dataset"),
    "es": ("temporada actual", "el conjunto de datos disponible"),
    "it": ("stagione in corso", "la base dati disponibile"),
    "fr": ("saison en cours", "la base de données disponible"),
    "id": ("musim berjalan", "data yang tersedia"),
}
# The opening label already gives the temporal scope, so retain it without a vendor name.
_SEASON = re.compile(
    _PROVIDER + r"\s*,\s*(" + "|".join(pair[0] for pair in _DATA.values()) + r")\b",
    re.IGNORECASE,
)
# These sentences already describe the limits of the data. Drop the attribution clause.
_ATTRIBUTION = re.compile(
    r"(?:\s+(?:primit(?:ă|ul)?|received|recibid[ao]|ricevut[ao]|reçu[e]?|yang diterima))?"
    r"(?:\s+(?:în|la|de la|din|in|at|from|en|de|da|di|su|dans|sur|chez|dari|nel|dalam)|\s+d')\s*"
    + _DATABASE
    + _PROVIDER
    + r"(?:\s+database\b)?(?!\w)",
    re.IGNORECASE,
)
_OFFICIAL = re.compile(r"(\b(?:oficial|official|ufficiale|officiel|resmi))\s*" + _PROVIDER, re.IGNORECASE)


def editorial_text(text: str, lang: str) -> str:
    """Remove vendor branding at display time, leaving archived inputs intact."""
    if not _PROVIDER_NAME.search(text):
        return text
    text = _SEASON.sub(lambda match: match[1].capitalize(), text)
    text = _ATTRIBUTION.sub("", text)
    text = _OFFICIAL.sub(r"\1", text)
    label = _DATA.get(lang, _DATA["en"])[1]
    return _PROVIDER_NAME.sub(
        lambda match: label.capitalize()
        if not text[: match.start()].rstrip()
        or text[: match.start()].rstrip().endswith((".", "!", "?", "(", ">", "—"))
        else label,
        text,
    )


_PUBLIC_DATA = {
    "ro": "datele competiției",
    "en": "competition data",
    "es": "datos de la competición",
    "it": "dati della competizione",
    "fr": "données de la compétition",
    "id": "data kompetisi",
}
_PUBLIC_PREFIX = re.compile(r"\bAPI[- ]Football\b,[ \t]+", re.IGNORECASE | re.ASCII)
_PUBLIC_NAME = re.compile(r"\bAPI[- ]Football\b", re.IGNORECASE | re.ASCII)


def public_analysis_text(text: str, lang: str) -> str:
    """Match the Worker's projection for comparison with the canonical archive."""
    return _PUBLIC_NAME.sub(_PUBLIC_DATA[lang], _PUBLIC_PREFIX.sub("", text))

"""Activate the static Google Play badge when the public listing allows installs."""

import argparse
from http.client import HTTPException
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from stat import S_IMODE
from tempfile import NamedTemporaryFile
from urllib.error import URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen


PACKAGE = "com.poseidonstats.app"
TITLE = "POSEIDON STATS"
PLAY_URL = f"https://play.google.com/store/apps/details?id={PACKAGE}"
PROBE_URL = f"{PLAY_URL}&hl=en&gl=RO"
MAX_HTML = 4 * 1024 * 1024
PENDING = (
    '<span class="google-play-pending" data-i18n="app.google.pending">Google Play · În curând</span>'
)
ACTIVE = (
    f'<a href="{PLAY_URL}" class="google-play-badge">'
    '<img src="assets/google-play/ro.svg" alt="Descarcă de pe Google Play · Android" '
    'data-i18n-attr="alt:app.google.download,src:app.google.badge">'
    '</a>'
)


def detail_url(url, package, *, install=False):
    if not isinstance(url, str):
        return False
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    qs = parse_qs(parts.query)
    return (
        parts.scheme == "https"
        and parts.netloc == "play.google.com"
        and re.fullmatch(r"/store/apps/details(?:/[^/]+)?/?", parts.path) is not None
        and qs.get("id") == [package]
        and (not install or qs.get("rdid") == [package])
    )


def clean(text):
    return " ".join(text.split()).casefold()


class Listing(HTMLParser):
    def __init__(self, package):
        super().__init__()
        self.package = package
        self.canonical = []
        self.headings = []
        self.schemas = []
        self.install = False
        self.heading = None
        self.schema = None
        self.button = None
        self.offer = False
        self.in_head = False
        self.inert = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in {"template", "noscript"}:
            self.inert.append(tag)
        if self.inert:
            return
        if tag == "head":
            self.in_head = True
        if self.in_head and tag == "link" and a.get("rel") == "canonical":
            self.canonical.append(a.get("href"))
        if tag == "script" and a.get("type") == "application/ld+json":
            self.schema = []
        if tag == "h1":
            self.heading = []
        if tag == "button":
            label = clean(a.get("aria-label") or "")
            disabled = (
                "disabled" in a or "hidden" in a or a.get("aria-disabled") == "true"
                or a.get("aria-hidden") == "true"
                or re.search(r"(?:display\s*:\s*none|visibility\s*:\s*hidden)", a.get("style") or "", re.I)
            )
            self.button = [] if label == "install" and not disabled else None
            self.offer = False
        if self.button is not None and tag == "meta" and a.get("itemprop") == "url":
            self.offer |= detail_url(a.get("content"), self.package, install=True)

    def handle_endtag(self, tag):
        if self.inert:
            if self.inert[-1] == tag:
                self.inert.pop()
            return
        if tag == "head":
            self.in_head = False
        if tag == "script" and self.schema is not None:
            try:
                self.schemas.append(json.loads("".join(self.schema)))
            except ValueError:
                pass
            self.schema = None
        if tag == "h1" and self.heading is not None:
            self.headings.append(clean("".join(self.heading)))
            self.heading = None
        if tag == "button" and self.button is not None:
            self.install |= self.offer and clean("".join(self.button)) == "install"
            self.button = None

    def handle_data(self, data):
        if self.inert:
            return
        if self.schema is not None:
            self.schema.append(data)
        if self.heading is not None:
            self.heading.append(data)
        if self.button is not None:
            self.button.append(data)


def is_installable(html, package=PACKAGE, title=TITLE):
    listing = Listing(package)
    listing.feed(html)
    listing.close()
    title = clean(title)
    return (
        len(listing.canonical) == 1
        and detail_url(listing.canonical[0], package)
        and listing.headings == [title]
        and listing.install
        and any(
            isinstance(schema, dict)
            and schema.get("@type") == "SoftwareApplication"
            and isinstance(schema.get("name"), str)
            and clean(schema["name"]) == title
            and detail_url(schema.get("url"), package)
            for schema in listing.schemas
        )
    )


def check_play():
    request = Request(PROBE_URL, headers={
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html",
        "Accept-Language": "en",
        "Cache-Control": "no-cache",
    })
    try:
        with urlopen(request, timeout=8) as response:
            if (response.status != 200 or not detail_url(response.geturl(), PACKAGE)
                    or response.headers.get_content_type() != "text/html"):
                return False
            body = response.read(MAX_HTML + 1)
            return len(body) <= MAX_HTML and is_installable(body.decode("utf-8"))
    except (HTTPException, URLError, OSError, ValueError):
        return False


def badge_blocks(html):
    for location in ("HERO", "FOOTER"):
        start = f"<!-- GOOGLE_PLAY_{location}_START -->"
        end = f"<!-- GOOGLE_PLAY_{location}_END -->"
        if html.count(start) != 1 or html.count(end) != 1:
            raise ValueError(f"Invalid Google Play markers in {location}")
        left = html.index(start) + len(start)
        right = html.index(end)
        if left >= right:
            raise ValueError(f"Unordered Google Play markers in {location}")
        yield left, right


def update(path, probe=check_play):
    html = path.read_text(encoding="utf-8")
    blocks = list(badge_blocks(html))
    state = [html[left:right].strip() for left, right in blocks]
    if state == [ACTIVE, ACTIVE]:
        return False  # One-way rollout; future probe failures cannot regress the published badge.
    if state != [PENDING, PENDING]:
        raise ValueError("Google Play badge placements are out of sync")
    if not probe():
        return False
    for left, right in sorted(blocks, reverse=True):
        body = html[left:right]
        before = body.removesuffix(body.lstrip())
        after = body.removeprefix(body.rstrip())
        html = f"{html[:left]}{before}{ACTIVE}{after}{html[right:]}"
    with NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=".google-play-", delete=False,
    ) as output:
        temporary = Path(output.name)
        try:
            output.write(html)
            output.close()
            temporary.chmod(S_IMODE(path.stat().st_mode))
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("index", type=Path)
    args = parser.parse_args()
    changed = update(args.index)
    message = "listing confirmed, download badge activated" if changed else "published badge unchanged"
    print(f"[Google Play] {message}")


if __name__ == "__main__":
    main()

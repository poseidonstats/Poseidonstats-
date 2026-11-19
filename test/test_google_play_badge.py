"""The homepage download link is activated only by a confirmed install offer."""

import importlib
import json
from pathlib import Path
import sys
from urllib.error import HTTPError

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
badge = importlib.import_module("google_play_badge")


def pending_home():
    return """<main>
    <a href="https://apps.apple.com/ro/app/poseidon-stats/id6824537161">Apple hero</a>
    <!-- GOOGLE_PLAY_HERO_START -->
    <span class="google-play-pending" data-i18n="app.google.pending">Google Play · În curând</span>
    <!-- GOOGLE_PLAY_HERO_END -->
    </main><footer>
    <a href="https://apps.apple.com/ro/app/poseidon-stats/id6824537161">Apple footer</a>
    <!-- GOOGLE_PLAY_FOOTER_START -->
    <span class="google-play-pending" data-i18n="app.google.pending">Google Play · În curând</span>
    <!-- GOOGLE_PLAY_FOOTER_END -->
    </footer>"""


def listing(*, package=badge.PACKAGE, title=badge.TITLE, offer=None, control=""):
    details = f"https://play.google.com/store/apps/details?id={package}"
    schema = json.dumps({"@type": "SoftwareApplication", "name": title, "url": details})
    if offer is None:
        offer = f'{details}&amp;rdid={package}'
    return f"""<!doctype html><html><head>
    <link rel="canonical" href="{details}">
    <script type="application/ld+json">{schema}</script>
    </head><body><h1><span>{title}</span></h1>
    <button aria-label="Install" {control}><span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <meta itemprop="url" content="{offer}"></span><span>Install</span></button>
    </body></html>"""


def test_recognizes_real_install_listing():
    assert badge.is_installable(listing())


@pytest.mark.parametrize("html", [
    "<h1>We're sorry, the requested URL was not found on this server.</h1>",
    listing(package="com.other.app"),
    listing(title="Another app"),
    listing(control="disabled"),
    listing(control='aria-disabled="true"'),
    listing(offer="https://play.google.com/store/apps/details?id=com.other.app&amp;rdid=com.other.app"),
    listing().replace("<button ", "<template><button ").replace("</button>", "</button></template>"),
    listing().replace("<button ", "<script><button ").replace("</button>", "</button></script>"),
    listing().replace(">Install</span>", ">Pre-register</span>"),
])
def test_rejects_200_pages_with_no_verified_install_offer(html):
    assert not badge.is_installable(html)


@pytest.mark.parametrize("status", [404, 429, 503])
def test_http_errors_cannot_activate(monkeypatch, status):
    def unavailable(request, timeout):
        raise HTTPError(request.full_url, status, "fixture", {}, None)

    monkeypatch.setattr(badge, "urlopen", unavailable)
    assert not badge.check_play()


def test_reference_badges_and_text_exist_for_every_site_language():
    translations = json.loads((ROOT / "assets/i18n.json").read_text())
    assert set(translations) == {"ro", "en", "es", "it", "fr", "id"}
    for lang, copy in translations.items():
        assert copy["app.google.pending"].startswith("Google Play · ")
        assert "Google Play" in copy["app.google.download"]
        assert copy["app.google.badge"] == f"assets/google-play/{lang}.svg"
        assert "<svg " in (ROOT / copy["app.google.badge"]).read_text()


def test_update_is_atomic_one_time_and_preserves_apple(tmp_path):
    index = tmp_path / "index.html"
    pending = pending_home()
    index.write_text(pending)
    assert not badge.update(index, lambda: False)
    assert index.read_text() == pending
    assert badge.update(index, lambda: True)
    active = index.read_text()
    assert active.count(f'href="{badge.PLAY_URL}"') == 2
    assert active.count("apps.apple.com/ro/app/poseidon-stats/id6824537161") == 2
    assert "Google Play · În curând" not in active
    assert "alt:app.google.download,src:app.google.badge" in active

    def must_not_probe():
        pytest.fail("An already confirmed launch is kept")

    assert not badge.update(index, must_not_probe)
    assert index.read_text() == active


def test_wrong_marker_refuses_partial_update(tmp_path):
    index = tmp_path / "index.html"
    invalid = pending_home().replace(
        "<!-- GOOGLE_PLAY_FOOTER_END -->", "<!-- unexpected -->",
    )
    index.write_text(invalid)
    with pytest.raises(ValueError, match="FOOTER"):
        badge.update(index, lambda: True)
    assert index.read_text() == invalid

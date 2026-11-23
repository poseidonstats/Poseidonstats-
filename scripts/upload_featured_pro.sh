#!/bin/bash
set -eu
export PATH="$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
set -a
. "$HOME/.config/cloudflare/env"
set +a
day=${1:-$(TZ=Europe/Bucharest date +%F)}
work=$(mktemp)
trap 'unlink "$work"' EXIT
"$HOME/football_predictor/.venv/bin/python3" -B "$HOME/poseidon-site/scripts/featured_pro.py" --date "$day" --output "$work"
cd "$HOME/poseidon-members"
wrangler kv key put --binding DATA "featured_pro_v1_$day" --path "$work" --remote
# Edge KV can return a cached miss after the morning site job. Wait for the
# public ID before baking the card into HTML; an unavailable service is retried.
"$HOME/football_predictor/.venv/bin/python3" - "$day" "$work" <<'PY'
import json
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

day, path = sys.argv[1:]
with open(path) as stream:
    item = json.load(stream)["item"]
expected = item["match"]["fixture_id"] if item else None
for delay in (0, 3, 8, 20, 35, 40):
    time.sleep(delay)
    try:
        request = Request("https://poseidon-members.poseidonstats.workers.dev/api/exemplu/" + day,
                          headers={"User-Agent": "POSEIDON-Site/1.0", "Accept": "application/json"})
        with urlopen(request, timeout=8) as response:
            public = json.load(response)
        if public["date"] == day and public["item"]["match"]["fixture_id"] == expected:
            break
    except HTTPError as exc:
        if exc.code == 404 and expected is None:
            break
    except (URLError, TimeoutError, ValueError, KeyError, TypeError):
        pass
else:
    raise SystemExit("Ruta publică nu a confirmat mostra zilei.")
PY

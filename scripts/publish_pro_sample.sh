#!/bin/bash
# Publică mostra eligibilă în serviciul anonim, apoi actualizează meciuri.html.
# Apelat după exportul zilei și de rezervele de la 07:50 și 12:35.
set -u
PY=~/football_predictor/.venv/bin/python3
# Serializează și reîncercările programate cu publicarea catalogului.
LOCK_HELPER=~/football_predictor/scripts/poseidon/pipeline_lock.py
if ! "$PY" "$LOCK_HELPER" --check-held; then
    exec "$PY" "$LOCK_HELPER" --run /bin/bash "$0" "$@"
fi
today=$(TZ=Europe/Bucharest date +%F)
day=${1:-$today}
[ "$day" = "$today" ] || { echo "Ediția $day nu mai este cea de azi."; exit 1; }
SITE=~/poseidon-site
LOG=$SITE/logs/publish.log
ts() { TZ=Europe/Bucharest date "+%Y-%m-%d %H:%M:%S"; }
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$SITE" || exit 1
bash "$SITE/scripts/upload_featured_pro.sh" "$day" >> "$LOG" 2>&1 || exit 1
$PY "$SITE/scripts/gen_pro_sample.py" --date "$day" >> "$LOG" 2>&1 || { echo "[$(ts)] [WARN] gen_pro_sample a eșuat — cardul NU s-a actualizat" >> "$LOG"; ~/odds_decoder/scripts/tg_trimite.sh "⚠️ Exemplul Pro: gen_pro_sample a eșuat, verifică exemplul public și catalogul zilei. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
$PY "$SITE/scripts/gate_html.py" "$SITE/meciuri.html" --vs HEAD >> "$LOG" 2>&1 || { echo "[$(ts)] [GATE HTML] pro_sample BLOCAT — meciuri.html stricat, nu împing" >> "$LOG"; ~/odds_decoder/scripts/tg_trimite.sh "❌ Exemplul Pro: meciuri.html a picat gate-ul HTML, nu s-a publicat. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
message="Actualizează exemplul Pro: $day"
if ! git diff --quiet HEAD -- meciuri.html; then
    git commit -q --only -m "$message" -- meciuri.html || exit 1
elif [ "$(git log -1 --format=%s)" != "$message" ] || [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
    echo "[$(ts)] [pro_sample] meciuri.html neschimbat" >> "$LOG"
    exit 0
fi
# O încercare anterioară poate avea commit local, dar push eșuat.
git push -q origin HEAD:main >> "$LOG" 2>&1 || { echo "[$(ts)] [WARN] pro_sample: push eșuat" >> "$LOG"; exit 1; }
echo "[$(ts)] [pro_sample] împins pe site" >> "$LOG"

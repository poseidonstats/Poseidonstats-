#!/bin/bash
# Publică mostra eligibilă în serviciul anonim, apoi actualizează meciuri.html.
# Jobul existent rulează la 07:50 și 12:35, ora României.
set -u
PY=~/football_predictor/.venv/bin/python3
SITE=~/poseidon-site
LOG=$SITE/logs/publish.log
ts() { TZ=Europe/Bucharest date "+%Y-%m-%d %H:%M:%S"; }
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$SITE" || exit 1
bash "$SITE/scripts/upload_featured_pro.sh" >> "$LOG" 2>&1 || exit 1
$PY "$SITE/scripts/gen_pro_sample.py" >> "$LOG" 2>&1 || { echo "[$(ts)] [WARN] gen_pro_sample (07:50) a eșuat — cardul NU s-a actualizat" >> "$LOG"; ~/odds_decoder/scripts/tg_trimite.sh "⚠️ Exemplul Pro (07:50): gen_pro_sample a eșuat, verifică exemplul public și catalogul zilei. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
$PY "$SITE/scripts/gate_html.py" "$SITE/meciuri.html" --vs HEAD >> "$LOG" 2>&1 || { echo "[$(ts)] [GATE HTML] pro_sample BLOCAT — meciuri.html stricat, nu împing" >> "$LOG"; ~/odds_decoder/scripts/tg_trimite.sh "❌ Exemplul Pro (07:50): meciuri.html a picat gate-ul HTML, nu s-a publicat. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
if git diff --quiet -- meciuri.html; then echo "[$(ts)] [pro_sample] meciuri.html neschimbat" >> "$LOG"; exit 0; fi
git add meciuri.html && git commit -q --only -m "Actualizează exemplul Pro: $(TZ=Europe/Bucharest date +%Y-%m-%d)" -- meciuri.html && git push -q origin HEAD \
  && echo "[$(ts)] [pro_sample] împins pe site" >> "$LOG" || { echo "[$(ts)] [WARN] pro_sample: publicare eșuată" >> "$LOG"; exit 1; }
exit 0

#!/bin/bash
# 2 oct 2026 — Exemplul de analiză Pro de pe prima pagină = analiza de AZI, publicată ÎNAINTE de meci (cerința Andreei).
# Analizele Pro se scriu la 07:20-07:30, după publicarea site-ului de la 06:10, deci cardul se împinge separat, de aici
# (6 oct 2026: plist propriu com.poseidonstats.pro_sample la 07:50 și 12:35, independent de wrangler/KV). Doar index.html; nimic altceva nu se atinge.
set -u
PY=~/football_predictor/.venv/bin/python3
SITE=~/poseidon-site
LOG=$SITE/logs/publish.log
ts() { TZ=Europe/Bucharest date "+%Y-%m-%d %H:%M:%S"; }
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$SITE" || exit 0
$PY "$SITE/scripts/gen_pro_sample.py" >> "$LOG" 2>&1 || { echo "[$(ts)] [WARN] gen_pro_sample (07:50) a eșuat — cardul NU s-a actualizat" >> "$LOG"; ~/odds_decoder/scripts/tg_trimite.sh "⚠️ Exemplul Pro (07:50): gen_pro_sample a eșuat, cardul de pe prima pagină NU e cel de azi. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
$PY "$SITE/scripts/gate_html.py" "$SITE/index.html" --vs HEAD >> "$LOG" 2>&1 || { echo "[$(ts)] [GATE HTML] pro_sample BLOCAT — index.html stricat, nu împing" >> "$LOG"; git checkout -- index.html; ~/odds_decoder/scripts/tg_trimite.sh "❌ Exemplul Pro (07:50): index.html a picat gate-ul HTML, nu s-a publicat. Vezi logs/publish.log" >/dev/null 2>&1; exit 1; }
if git diff --quiet -- index.html; then echo "[$(ts)] [pro_sample] index.html neschimbat" >> "$LOG"; exit 0; fi
git add index.html && git commit -q -m "Exemplul Pro al zilei: $(TZ=Europe/Bucharest date +%Y-%m-%d), publicat înainte de meci" && git push -q origin HEAD \
  && echo "[$(ts)] [pro_sample] împins pe site" >> "$LOG" || echo "[$(ts)] [WARN] pro_sample: push eșuat" >> "$LOG"
exit 0

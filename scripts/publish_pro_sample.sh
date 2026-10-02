#!/bin/bash
# 2 oct 2026 — Exemplul de analiză Pro de pe prima pagină = analiza de AZI, publicată ÎNAINTE de meci (cerința Andreei).
# Analizele Pro se scriu la 07:20-07:30, după publicarea site-ului de la 06:10, deci cardul se împinge separat, de aici
# (chemat din upload_members_data.sh la 07:45, după ce arhiva zilei există). Doar index.html; nimic altceva nu se atinge.
set -u
PY=~/football_predictor/.venv/bin/python3
SITE=~/poseidon-site
LOG=$SITE/logs/publish.log
ts() { TZ=Europe/Bucharest date "+%Y-%m-%d %H:%M:%S"; }
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$SITE" || exit 0
$PY "$SITE/scripts/gen_pro_sample.py" >> "$LOG" 2>&1 || { echo "[$(ts)] [WARN] gen_pro_sample (07:45) failed — cardul rămâne" >> "$LOG"; exit 0; }
if git diff --quiet -- index.html; then echo "[$(ts)] [pro_sample] index.html neschimbat" >> "$LOG"; exit 0; fi
git add index.html && git commit -q -m "Exemplul Pro al zilei: $(TZ=Europe/Bucharest date +%Y-%m-%d), publicat înainte de meci" && git push -q origin HEAD \
  && echo "[$(ts)] [pro_sample] împins pe site" >> "$LOG" || echo "[$(ts)] [WARN] pro_sample: push eșuat" >> "$LOG"
exit 0

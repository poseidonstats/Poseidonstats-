#!/bin/bash
# POSEIDON site — publicare zilnică pe GitHub Pages.
# Cron: rulează la 07:50 (după POSEIDON 07:15 + resolve 07:45).
#
# Pași:
#   1. Regenerează JSON-urile publice din ~/football_predictor/data/
#   2. git add + commit + push (doar dacă datele s-au schimbat)
#
# Logs: ~/poseidon-site/logs/publish.log

set -e
LOG=~/poseidon-site/logs/publish.log
mkdir -p ~/poseidon-site/logs

PY=~/football_predictor/.venv/bin/python3
ts() { date '+%Y-%m-%d %H:%M:%S'; }

echo "[$(ts)] === POSEIDON publish cycle ===" >> "$LOG"

# 1. Build JSON-uri
cd ~/football_predictor
$PY scripts/poseidon/build_public_json.py >> "$LOG" 2>&1
RC1=$?
if [ $RC1 -ne 0 ]; then
    echo "[$(ts)] [ERR] build_public_json failed rc=$RC1" >> "$LOG"
    exit $RC1
fi

# 2. Git add/commit/push
cd ~/poseidon-site
if [ -z "$(git status --porcelain data/)" ]; then
    echo "[$(ts)] No changes to publish." >> "$LOG"
    exit 0
fi
git add data/
git commit -m "data: $(date +%Y-%m-%d) refresh predicții + jurnal" >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1
RC2=$?
if [ $RC2 -ne 0 ]; then
    echo "[$(ts)] [ERR] git push failed rc=$RC2" >> "$LOG"
    exit $RC2
fi
echo "[$(ts)] Published." >> "$LOG"

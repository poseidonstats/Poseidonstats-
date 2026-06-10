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

# 🆕 10 iun 2026 — Anti-dublă-publicare (Opțiunea 3 flag-based).
# Cauza: cronul publish 07:50 + self-heal 07:15-08:01 generau 2 publicări (146 incompletă + 964 completă).
# Soluție: skip publish dacă (a) self-heal activ (lock) SAU (b) CSV deja proaspăt <45 min (self-heal a publicat).
# Safety net păstrat: dacă self-heal NU a rulat azi (CSV vechi de ieri), publish-ul rulează normal.
LOCKDIR=/tmp/poseidon_pipeline.lock.d
CSV=~/football_predictor/data/poisson_advanced_predictions.csv

# (a) Lock activ → self-heal rulează simultan → SKIP
if [ -d "$LOCKDIR" ]; then
    PID_OWNER=$(cat "$LOCKDIR/pid" 2>/dev/null || echo "")
    if [ -n "$PID_OWNER" ] && kill -0 "$PID_OWNER" 2>/dev/null; then
        echo "[$(ts)] [SKIP] Self-heal activ (PID $PID_OWNER) — publish-ul self-heal va termina lanțul" >> "$LOG"
        exit 0
    fi
fi

# (b) CSV proaspăt <45 min → self-heal tocmai a publicat → SKIP (evită dublu commit)
if [ -f "$CSV" ]; then
    MTIME=$(stat -f %m "$CSV" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    AGE_MIN=$(( (NOW - MTIME) / 60 ))
    if [ "$AGE_MIN" -lt 45 ]; then
        echo "[$(ts)] [SKIP] CSV publicat recent (${AGE_MIN}min < 45) — self-heal deja a finalizat lanțul" >> "$LOG"
        exit 0
    fi
fi

# Cazul normal (safety net): self-heal nu a rulat sau a eșuat → continue publish pe CSV existent

# 0. Curăță fixturi cu microsecunde (.000000) — pas defensiv.
# API-Football adaugă uneori microsecunde la backfill; Fix B le acceptă,
# dar le curățăm la sursă ca să rămână DB curat.
sqlite3 ~/football_predictor/football.db \
  "UPDATE fixtures SET date = SUBSTR(date, 1, 19) WHERE date LIKE '%.000000';" \
  >> "$LOG" 2>&1

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

# 3. Telegram notify — plasă siguranță (nu blochează publish dacă cade)
$PY ~/poseidon-site/scripts/notify_publish.py >> "$LOG" 2>&1 || \
    echo "[$(ts)] [WARN] notify_publish failed (publish OK, doar Telegram)" >> "$LOG"

#!/bin/bash
# POSEIDON site — publicare zilnică pe GitHub Pages.
# Cron: rulează la 07:50 (după POSEIDON 07:15 + resolve 07:45).
#
# Pași:
#   1. Regenerează JSON-urile publice din ~/football_predictor/data/
#   2. git add + commit + push (doar dacă datele s-au schimbat)
#
# Logs: ~/poseidon-site/logs/publish.log

# 🆕 13 iun 2026 — R2: -E (errtrace) ca trap-ul ERR să se propage; orice comandă
# care pică sub set -e trece acum prin on_err → log + alertă ❌ Telegram pe calea
# STANDALONE (de pe calea self-heal alertează părintele, aici doar logăm).
set -eE
LOG=~/poseidon-site/logs/publish.log
mkdir -p ~/poseidon-site/logs

PY=~/football_predictor/.venv/bin/python3
ts() { date '+%Y-%m-%d %H:%M:%S'; }

# Trimiterea Telegram trece prin helper-ul comun (citește ~/football_v7/.telegram_config.json).
TG_HELPER=~/football_predictor/scripts/poseidon/telegram_alert.py
tg_send_quick() {
    # Transport via helper-ul comun (singura cale). Best-effort: stdout (message_id)
    # ignorat, doar erorile (stderr) ajung în log; `|| true` ca să nu cadă sub set -eE.
    "$PY" "$TG_HELPER" "$1" > /dev/null 2>> "$LOG" || true
}

on_err() {
    local rc=$? line=$1
    echo "[$(ts)] [ERR] daily_publish FAIL rc=$rc la linia $line" >> "$LOG"
    if [ "$POSEIDON_FROM_SELF_HEAL" != "1" ]; then
        tg_send_quick "❌ <b>POSEIDON daily_publish (standalone) FAIL</b>
rc=$rc la linia $line
Verifică ~/poseidon-site/logs/publish.log"
    fi
}
trap 'on_err $LINENO' ERR

echo "[$(ts)] === POSEIDON publish cycle ===" >> "$LOG"

# 🆕 10 iun 2026 — Anti-dublă-publicare (Opțiunea 3 flag-based).
# Cauza: cronul publish 07:50 + self-heal 07:15-08:01 generau 2 publicări (146 incompletă + 964 completă).
# Soluție: skip publish dacă (a) self-heal activ (lock) SAU (b) CSV deja proaspăt <45 min (self-heal a publicat).
# Safety net păstrat: dacă self-heal NU a rulat azi (CSV vechi de ieri), publish-ul rulează normal.
#
# 🆕 11 iun 2026 — Fix self-deadlock: când self-heal cheamă ACEST script (pas 4c),
# lock-ul e ținut chiar de părintele lui → guard (a) făcea SKIP și nimeni nu publica
# (incident 11 iun: alertă ✅ pe date de ieri, site stale în ziua de start Mondial).
# Guard (b) ar fi blocat la fel (CSV scris de self-heal cu secunde înainte).
# Marker POSEIDON_FROM_SELF_HEAL=1 → ambele guard-uri se sar, cu urmă explicită în log.
LOCKDIR=/tmp/poseidon_pipeline.lock.d
CSV=~/football_predictor/data/poisson_advanced_predictions.csv

if [ "$POSEIDON_FROM_SELF_HEAL" = "1" ]; then
    echo "[$(ts)] [BYPASS] guards bypassed: called from self-heal (parent PID $PPID)" >> "$LOG"
else
    # (a) Lock activ → self-heal rulează simultan → SKIP
    if [ -d "$LOCKDIR" ]; then
        PID_OWNER=$(cat "$LOCKDIR/pid" 2>/dev/null || echo "")
        if [ -n "$PID_OWNER" ] && kill -0 "$PID_OWNER" 2>/dev/null; then
            echo "[$(ts)] [SKIP] Self-heal activ (PID $PID_OWNER) — publish-ul self-heal va termina lanțul" >> "$LOG"
            exit 0
        fi
    fi

    # (b) CSV proaspăt <45 min → self-heal tocmai a publicat → SKIP (evită dublu commit)
    # 🆕 13 iun — R1: SKIP doar dacă publish-ul e CONFIRMAT (marker E2E scris de
    # self-heal). CSV proaspăt FĂRĂ marker = self-heal a crăpat între predict și
    # publish → acest cron devine plasa de siguranță imediată și publică.
    # (Dacă self-heal e încă în lucru, guard-ul (a) de mai sus l-a prins deja.)
    PUBLISH_MARKER="$HOME/.football_predictor/publish_done_$(date +%Y-%m-%d)"
    if [ -f "$CSV" ]; then
        MTIME=$(stat -f %m "$CSV" 2>/dev/null || echo 0)
        NOW=$(date +%s)
        AGE_MIN=$(( (NOW - MTIME) / 60 ))
        if [ "$AGE_MIN" -lt 45 ]; then
            if [ -f "$PUBLISH_MARKER" ]; then
                echo "[$(ts)] [SKIP] CSV publicat recent (${AGE_MIN}min < 45) + marker E2E prezent — self-heal a finalizat lanțul" >> "$LOG"
                exit 0
            fi
            echo "[$(ts)] [INFO] CSV recent (${AGE_MIN}min) dar marker publish LIPSĂ — continui publish (safety net R1)" >> "$LOG"
        fi
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
# (13 iun — R2: verificarea RC1 de aici era COD MORT sub set -e; eșecul e
#  gestionat acum de trap ERR → log + alertă.)
cd ~/football_predictor
$PY scripts/poseidon/build_public_json.py >> "$LOG" 2>&1

# 2. Git add/commit/push
cd ~/poseidon-site
if [ -z "$(git status --porcelain data/)" ]; then
    echo "[$(ts)] No changes to publish." >> "$LOG"
    exit 0
fi

# 🆕 13 iun (Val 2, task #3) — Gate de sanitate ÎNAINTE de git add: nu publica date
# goale/degenerate. Vechiul guard de mai sus verifica DOAR că datele s-au schimbat, nu că
# sunt valide → un predictions.json gol/invalid (build exit 0 pe upstream gol) era împins
# tăcut. Gate-ul ABORTEAZĂ push-ul la eșec (fără `|| true` — un eșec aici lasă date GREȘITE
# să treacă); alerta Telegram rămâne best-effort (canal lateral). `|| GATE_RC=$?` capturează
# RC fără ca set -eE să omoare scriptul înainte de a-l citi.
MIN_MATCHES=20
VALIDATOR=~/football_predictor/scripts/poseidon/validate_public_json.py
GATE_RC=0
GATE_OUT=$("$PY" "$VALIDATOR" ~/poseidon-site/data/predictions.json --min-matches "$MIN_MATCHES" --max-skew 5.0 2>&1) || GATE_RC=$?
if [ "$GATE_RC" -ne 0 ]; then
    echo "[$(ts)] [GATE] BLOCAT push: $GATE_OUT" >> "$LOG"
    tg_send_quick "❌ <b>POSEIDON publish BLOCAT — gate sanitate</b>
$GATE_OUT
NU s-a făcut push (date goale/invalide). Verifică build_public_json + predict_daily."
    exit 1
fi
echo "[$(ts)] [GATE] OK: $GATE_OUT" >> "$LOG"

# (13 iun — R2: verificarea RC2 era COD MORT sub set -e; push eșuat → trap ERR.)
git add data/
git commit -m "data: $(date +%Y-%m-%d) refresh predicții + jurnal" >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1
echo "[$(ts)] Published." >> "$LOG"

# 3. Telegram notify — plasă siguranță (nu blochează publish dacă cade)
$PY ~/poseidon-site/scripts/notify_publish.py >> "$LOG" 2>&1 || \
    echo "[$(ts)] [WARN] notify_publish failed (publish OK, doar Telegram)" >> "$LOG"

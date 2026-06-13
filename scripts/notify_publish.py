"""Telegram notify după publish — plasă de siguranță peste automatizare.

Citește predictions.json + forward.json (post-publish) și trimite:
- număr meciuri publicate
- număr resolved + hit% recent
- FLAG-uri pentru anomalii (volum suspect, prob extreme calibrate, drop volum >50%)

Rulat din daily_publish.sh după git push, nu blochează publicarea dacă cade.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Singura cale de trimitere Telegram (modul comun, în repo-ul football_predictor).
sys.path.insert(0, str(Path.home() / "football_predictor" / "scripts" / "poseidon"))
from telegram_alert import send_telegram_alert  # noqa: E402

SITE_DATA = Path.home() / "poseidon-site" / "data"
PRED_HISTORY = Path.home() / "poseidon-site" / "data" / ".last_publish_count.txt"

# Praguri anomalii
VOLUME_DROP_PCT = 0.50      # azi <50% din ultima publicare = suspect
VOLUME_SURGE_PCT = 0.50     # azi >150% (+50%) din ultima publicare = suspect (cron stale CSV)
VOLUME_LOW_ABS = 50         # <50 meciuri total = mult prea puțin
EXTREME_PROB = 0.92         # prob 1X2/Over peste 92% calibrat = posibil rating extrem


def telegram_send(text: str) -> bool:
    """Transport via helper-ul comun (telegram_alert). Best-effort: logăm pe stderr."""
    try:
        send_telegram_alert(text)
        return True
    except Exception as e:
        print(f"[ERR] tg: {e}", file=sys.stderr)
        return False


def main() -> int:
    pred_path = SITE_DATA / "predictions.json"
    fwd_path = SITE_DATA / "forward.json"
    if not pred_path.exists():
        print("[ERR] predictions.json lipsă", file=sys.stderr)
        return 1

    pred = json.load(open(pred_path))
    matches = pred.get("matches", [])
    n_total = len(matches)

    # Meciuri AZI (cu timezone Europa/Bucharest = UTC+3 vara)
    today_utc = datetime.now(timezone.utc).date()
    today_eest = (datetime.now(timezone.utc) + timedelta(hours=3)).date()
    n_today = sum(1 for m in matches
                  if (datetime.fromisoformat(m["match_date"].replace("Z", "+00:00"))
                      + timedelta(hours=3)).date() == today_eest)

    # Forward — resolved + hit recent
    n_resolved = n_pending = 0
    hit_o15 = None
    if fwd_path.exists():
        fwd = json.load(open(fwd_path))
        n_resolved = fwd.get("n_resolved", 0)
        n_pending = fwd.get("n_pending", 0)
        # Hit cumulat pe Over 1.5 (cel mai bine reprezentat)
        for mk in fwd.get("markets", []):
            if mk["name"].startswith("Over 1.5"):
                buckets = mk.get("buckets", [])
                tot_n = sum(b["n"] for b in buckets)
                tot_w = sum(b["n"] * b["hit_pct"] / 100 for b in buckets)
                if tot_n >= 30:
                    hit_o15 = (round(tot_w), tot_n)
                break

    # FLAG-uri anomalii
    flags = []
    if n_total < VOLUME_LOW_ABS:
        flags.append(f"⚠️ volum scăzut: doar {n_total} meciuri publicate (sub {VOLUME_LOW_ABS})")

    # Volum față de ultima publicare (drop >50%)
    if PRED_HISTORY.exists():
        try:
            prev = int(PRED_HISTORY.read_text().strip())
            if prev > 0 and n_total < prev * (1 - VOLUME_DROP_PCT):
                flags.append(f"⚠️ drop volum: azi {n_total} vs ieri {prev} (−{round(100*(prev-n_total)/prev)}%)")
            elif prev > 0 and n_total > prev * (1 + VOLUME_SURGE_PCT):
                flags.append(f"⚠️ surge volum: azi {n_total} vs ieri {prev} (+{round(100*(n_total-prev)/prev)}%) — verifică CSV freshness (cron predict_daily a rulat azi?)")
        except Exception:
            pass
    PRED_HISTORY.write_text(str(n_total))

    # Prob extreme pe ligi calibrate (posibil rating outlier scăpat de filtru)
    extreme = [m for m in matches
               if m.get("calibrated")
               and max(m.get("prob_home", 0) or 0,
                       m.get("prob_away", 0) or 0,
                       m.get("prob_over_2_5", 0) or 0,
                       m.get("prob_btts", 0) or 0) >= EXTREME_PROB]
    if extreme:
        sample = extreme[:3]
        names = "; ".join(f"{m['home_team']} vs {m['away_team']}" for m in sample)
        flags.append(f"⚠️ {len(extreme)} meciuri cu prob ≥{int(EXTREME_PROB*100)}% pe ligă calibrată — verifică: {names}")

    # Probabilitățile publicate trebuie să fie post-Platt (calibration.json meta,
    # scris de build_public_json). Orice altceva (raw, cheie lipsă, fișier corupt)
    # = calibrarea NU s-a aplicat la acest publish.
    prob_mode = None
    try:
        prob_mode = json.load(open(SITE_DATA / "calibration.json")).get("meta", {}).get("probabilities")
    except Exception as e:
        flags.append(f"⚠️ calibration.json ilizibil ({e}) — nu pot verifica modul probabilităților")
    else:
        if prob_mode != "post-platt":
            flags.append(f"⚠️ probabilități publicate NE-calibrate: meta.probabilities={prob_mode!r} (așteptat 'post-platt')")

    # Compun mesaj
    lines = [
        "🔔 <b>POSEIDON publish</b>",
        f"📅 {today_eest.strftime('%d %b %Y')}",
        "",
        f"📊 <b>{n_total}</b> meciuri publicate (din care <b>{n_today}</b> azi)",
        f"✅ <b>{n_resolved}</b> rezolvate · {n_pending} pending",
    ]
    if hit_o15:
        wins, n = hit_o15
        lines.append(f"🎯 Over 1.5 cumulat: {wins}/{n} ({round(100*wins/n)}%)")
    lines.append(f"🌐 <a href='https://poseidonstats.com'>poseidonstats.com</a>")
    if flags:
        lines.append("")
        lines.append("<b>ATENȚIE:</b>")
        for f in flags:
            lines.append(f)

    msg = "\n".join(lines)
    ok = telegram_send(msg)
    print(f"[notify_publish] sent={ok} flags={len(flags)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

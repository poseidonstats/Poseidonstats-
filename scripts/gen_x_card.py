#!/usr/bin/env python3
"""Carduri pentru X (1200×675): „Today's 3" (selecții + probabilități) și „Yesterday, verified" (scor + bifă).
Uz:
  gen_x_card.py azi  --out card.png --data '[{"meci":"Algeria v Niger","piata":"Home win","p":0.80}, ...]'
  gen_x_card.py ieri --out card.png --data '[{"meci":"Algeria v Niger","piata":"Home win","p":0.80,"scor":"2-0","hit":true}, ...]'
Fără nume de case, fără „bate casa"; disclaimer pe fiecare card.
"""
from __future__ import annotations
import argparse, json, math, datetime as dt
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 675
NAVY = (18, 30, 72); GOLD = (242, 190, 60); WHITE = (245, 245, 245); GREY = (170, 178, 200)
GREEN = (72, 190, 120); RED = (220, 80, 80); BAR_BG = (40, 56, 110)


def font(sz: int, bold: bool = False):
    for p in ("/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(p, sz, index=1 if (bold and p.endswith(".ttc")) else 0)
        except Exception:
            pass
    return ImageFont.load_default()


def fundal() -> Image.Image:
    img = Image.new("RGB", (W, H)); px = img.load(); cx, cy = W * 0.5, H * 0.35
    for y in range(H):
        for x in range(W):
            t = min(1.0, math.hypot((x - cx) / W, (y - cy) / H) * 1.7)
            px[x, y] = (int(NAVY[0] + 14 * (1 - t) - 8 * t), int(NAVY[1] + 22 * (1 - t) - 12 * t), int(NAVY[2] + 48 * (1 - t) - 30 * t))
    return img


def antet(d: ImageDraw.ImageDraw, titlu: str, sub: str) -> None:
    d.text((60, 42), "POSEIDON STATS", font=font(26, True), fill=GOLD)
    d.text((60, 80), titlu, font=font(54, True), fill=WHITE)
    d.text((62, 146), sub, font=font(24), fill=GREY)
    d.line((60, 190, W - 60, 190), fill=GOLD, width=2)


def subsol(d: ImageDraw.ImageDraw, text: str) -> None:
    d.text((60, H - 48), text, font=font(20), fill=GREY)
    d.text((W - 60 - d.textlength("poseidonstats.com", font=font(22, True)), H - 50), "poseidonstats.com", font=font(22, True), fill=GOLD)


def card_azi(picks: list[dict], zi: str) -> Image.Image:
    img = fundal(); d = ImageDraw.Draw(img)
    antet(d, "Today's picks", f"{zi} · model probability, frozen before kick-off · results posted tomorrow")
    y0 = 225; pas = (H - 70 - y0) // max(1, len(picks))
    for i, p in enumerate(picks):
        y = y0 + i * pas
        d.text((60, y), p["meci"], font=font(34, True), fill=WHITE)
        d.text((60, y + 44), p["piata"], font=font(26), fill=GREY)
        bx0, bx1 = 640, W - 190; bh = 26
        d.rounded_rectangle((bx0, y + 22, bx1, y + 22 + bh), radius=13, fill=BAR_BG)
        d.rounded_rectangle((bx0, y + 22, bx0 + int((bx1 - bx0) * p["p"]), y + 22 + bh), radius=13, fill=GOLD)
        pct = f"{round(p['p'] * 100)}%"
        d.text((W - 60 - d.textlength(pct, font=font(46, True)), y + 8), pct, font=font(46, True), fill=GOLD)
    subsol(d, "18+ · informational only · every pick stays up, wins and losses")
    return img


def card_ieri(picks: list[dict], zi: str) -> Image.Image:
    img = fundal(); d = ImageDraw.Draw(img)
    n = len(picks); k = sum(1 for p in picks if p.get("hit"))
    antet(d, "Yesterday, verified", f"{zi} · posted before kick-off · {k}/{n} hit")
    y0 = 225; pas = (H - 70 - y0) // max(1, n)
    for i, p in enumerate(picks):
        y = y0 + i * pas; ok = bool(p.get("hit"))
        d.text((60, y), p["meci"], font=font(34, True), fill=WHITE)
        d.text((60, y + 44), f"{p['piata']} · {round(p['p'] * 100)}%", font=font(26), fill=GREY)
        d.text((760, y + 6), p.get("scor", "—"), font=font(44, True), fill=WHITE)
        c = GREEN if ok else RED; cx, cy = W - 100, y + 30
        d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=c)
        if ok:
            d.line((cx - 13, cy, cx - 4, cy + 10), fill=NAVY, width=6); d.line((cx - 4, cy + 10, cx + 14, cy - 10), fill=NAVY, width=6)
        else:
            d.line((cx - 11, cy - 11, cx + 11, cy + 11), fill=NAVY, width=6); d.line((cx - 11, cy + 11, cx + 11, cy - 11), fill=NAVY, width=6)
    subsol(d, "18+ · informational only · hits and misses both stay up")
    return img


def main() -> None:
    ap = argparse.ArgumentParser(); ap.add_argument("tip", choices=["azi", "ieri"]); ap.add_argument("--data", required=True)
    ap.add_argument("--zi", default=dt.date.today().strftime("%-d %b %Y")); ap.add_argument("--out", required=True); a = ap.parse_args()
    picks = json.loads(a.data)
    (card_azi if a.tip == "azi" else card_ieri)(picks, a.zi).save(a.out); print(a.out)


if __name__ == "__main__":
    main()

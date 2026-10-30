"""Proveniență Pro și chitanțe de livrare (30 octombrie 2026).

Arhiva și intrările originale rămân nemodificate; livrarea observată se scrie
atomic într-un sidecar legat de SHA arhivei. Datele istorice fără dovadă nu
primesc retroactiv o oră presupusă de publicare.
"""

from __future__ import annotations

import fcntl
import hashlib
import json
import os
import re
import tempfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def stamp(value):
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc) if dt.tzinfo else None
    except ValueError:
        return None


def sha(value) -> str:
    raw = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def identitate(item: dict) -> str:
    proof = {
        k: v for k, v in item.get("provenance", {}).items() if k != "prediction_id"
    }
    # Livrarea nu face parte din predicție; textele/echipele/probele de intrare da.
    return sha(
        {
            "match": item.get("match"),
            "texts": {
                k: v
                for k, v in item.items()
                if k == "analysis" or k.startswith("analysis_")
            },
            "provenance": proof,
        }
    )


def cu_provenienta(
    item: dict, inputs: dict, model_sha256: str, *, captured_at=None, generated_at=None
) -> dict:
    out = dict(item)
    ko = stamp(item.get("match", {}).get("match_date"))
    out["provenance"] = {
        "schema": 1,
        "original_kickoff_utc": ko.isoformat() if ko else None,
        "inputs_captured_at_utc": captured_at or utc_now(),
        "generated_at_utc": generated_at or utc_now(),
        "model_sha256": model_sha256,
        "inputs_sha256": sha(inputs),
        "inputs": inputs,
    }
    out["provenance"]["prediction_id"] = identitate(out)
    return out


@contextmanager
def blocare(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def atomic_json(path: Path, value: dict):
    fd, name = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as out:
            json.dump(value, out, ensure_ascii=False, indent=2, allow_nan=False)
            out.flush()
            os.fsync(out.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def citeste_livrari(path: Path) -> dict:
    sidecar = path.with_suffix(".delivery.json")
    if not sidecar.exists():
        return {}
    receipt = json.loads(sidecar.read_text())
    current = hashlib.sha256(path.read_bytes()).hexdigest()
    return receipt if receipt.get("archive_sha256") == current else {}


def marcheaza_livrare(path: Path, indices, channel: str, *, at=None):
    if channel not in ("site", "discord"):
        raise ValueError("canal de livrare necunoscut")
    observed = at or utc_now()
    if stamp(observed) is None:
        raise ValueError("livrarea cere moment UTC explicit")
    with blocare(path.with_suffix(".delivery.lock")):
        receipt = citeste_livrari(path)
        if path.with_suffix(".delivery.json").exists() and not receipt:
            raise ValueError(
                "arhiva s-a schimbat; păstrez chitanța originală, fără retimestampare"
            )
        if not receipt:
            receipt = {
                "schema": 1,
                "archive_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "deliveries": [],
            }
        payload = json.loads(path.read_text())
        for index in indices:
            item = payload["items"][index]
            pid = item.get("provenance", {}).get("prediction_id") or identitate(item)
            if any(
                r["prediction_id"] == pid and r["channel"] == channel
                for r in receipt["deliveries"]
            ):
                continue
            receipt["deliveries"].append(
                {
                    "prediction_id": pid,
                    "fixture_id": item.get("match", {}).get("fixture_id"),
                    "channel": channel,
                    "published_at_utc": observed,
                    "original_kickoff_utc": item.get("provenance", {}).get(
                        "original_kickoff_utc"
                    ),
                }
            )
        atomic_json(path.with_suffix(".delivery.json"), receipt)


def eligibilitate(item: dict, deliveries: dict, *, now=None) -> tuple[bool, str]:
    if item.get("exclude_from_forward_test") or item.get("published_late"):
        return False, "exclus_explicit"
    proof = item.get("provenance") or {}
    try:
        if proof.get("schema") != 1 or proof.get("prediction_id") != identitate(item):
            return False, "provenienta_absenta_sau_modificata"
        if (
            not isinstance(proof.get("model_sha256"), str)
            or not re.fullmatch(r"[0-9a-f]{64}", proof["model_sha256"])
            or proof.get("inputs_sha256") != sha(proof["inputs"])
        ):
            return False, "intrari_model_neverificate"
    except (TypeError, ValueError, KeyError):
        return False, "intrari_model_neverificate"
    ko = stamp(proof.get("original_kickoff_utc"))
    captured = stamp(proof.get("inputs_captured_at_utc"))
    generated = stamp(proof.get("generated_at_utc"))
    observed_now = stamp(now or utc_now())
    if (
        not ko
        or not captured
        or not generated
        or not observed_now
        or generated > observed_now
        or stamp(item.get("match", {}).get("match_date")) != ko
        or not captured <= generated < ko
    ):
        return False, "cronologie_neverificata"
    publications = [
        stamp(r.get("published_at_utc"))
        for r in deliveries.get("deliveries", [])
        if r.get("prediction_id") == proof["prediction_id"]
        and r.get("fixture_id") == item.get("match", {}).get("fixture_id")
        and r.get("original_kickoff_utc") == proof["original_kickoff_utc"]
        and r.get("channel") in ("site", "discord")
    ]
    if not any(p and generated <= p < ko and p <= observed_now for p in publications):
        return False, "publicare_prematch_neconfirmata"
    return True, "eligibil"

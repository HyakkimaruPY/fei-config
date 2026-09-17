#!/usr/bin/env python3
"""Validate public CORS relays and publish only healthy ones.

This runs in GitHub Actions, never in the generated SRHELL apps. It probes a
neutral marker file, verifies that the relay returns the expected body and a
usable Access-Control-Allow-Origin header, measures latency, and writes the
validated pool sorted from fastest to slowest. If nothing passes, an empty pool
is published: stale/unverified proxies are never kept alive implicitly.
"""

from __future__ import annotations

import concurrent.futures
import json
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "html-generator/v6.6/runtime/shared/proxy-candidates.json"
OUTPUT = ROOT / "html-generator/v6.6/runtime/shared/proxy-pool.json"
TEST_ORIGIN = "https://srhell.local"
USER_AGENT = "SRHELL-CORS-Validator/1.1 (+GitHub Actions)"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def proxy_url(template: str, target: str) -> str:
    template = str(template or "").strip()
    target = str(target or "").strip()
    encoded = urllib.parse.quote(target, safe="")
    if "{rawUrl}" in template:
        return template.replace("{rawUrl}", target)
    if "{raw}" in template:
        return template.replace("{raw}", target)
    if "{url}" in template:
        return template.replace("{url}", encoded)
    if template.endswith("=") or template.endswith("?"):
        return template + encoded
    return template + ("&" if "?" in template else "?") + "url=" + encoded


def cors_header_is_usable(value: str | None) -> bool:
    value = (value or "").strip()
    if not value:
        return False
    if value == "*":
        return True
    allowed = [part.strip() for part in value.split(",") if part.strip()]
    return TEST_ORIGIN in allowed


def run_attempt(entry: dict, target: str, marker: str, timeout_s: float) -> dict:
    url = proxy_url(entry["template"], target)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Origin": TEST_ORIGIN,
            "Accept": "text/plain,*/*;q=0.1",
            "Cache-Control": "no-cache",
        },
        method="GET",
    )
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            body = response.read(65536).decode("utf-8", errors="replace")
            elapsed_ms = max(1, round((time.perf_counter() - started) * 1000))
            status = int(getattr(response, "status", 200) or 200)
            acao = response.headers.get("Access-Control-Allow-Origin", "")
            ok = 200 <= status < 400 and marker in body and cors_header_is_usable(acao)
            return {
                "ok": ok,
                "latencyMs": elapsed_ms,
                "status": status,
                "acao": acao,
                "error": "" if ok else (
                    "marker ausente" if marker not in body else "CORS header inválido"
                ),
            }
    except urllib.error.HTTPError as exc:
        return {
            "ok": False,
            "latencyMs": max(1, round((time.perf_counter() - started) * 1000)),
            "status": int(exc.code or 0),
            "acao": exc.headers.get("Access-Control-Allow-Origin", "") if exc.headers else "",
            "error": f"HTTP {exc.code}",
        }
    except Exception as exc:
        return {
            "ok": False,
            "latencyMs": max(1, round((time.perf_counter() - started) * 1000)),
            "status": 0,
            "acao": "",
            "error": f"{type(exc).__name__}: {exc}",
        }


def validate_proxy(entry: dict, target: str, marker: str, attempts: int, timeout_s: float, minimum: int) -> dict:
    results = [run_attempt(entry, target, marker, timeout_s) for _ in range(attempts)]
    successful = [r for r in results if r["ok"]]
    valid = len(successful) >= minimum
    latency = round(statistics.median([r["latencyMs"] for r in successful])) if successful else None
    last = successful[-1] if successful else results[-1]
    return {
        "id": str(entry["id"]),
        "name": str(entry.get("name") or entry["id"]),
        "template": str(entry["template"]),
        "priority": int(entry.get("priority") or 50),
        "valid": valid,
        "latencyMs": latency,
        "successes": len(successful),
        "attempts": attempts,
        "successRate": round(len(successful) / attempts, 3),
        "lastStatus": int(last.get("status") or 0),
        "corsAllowOrigin": str(last.get("acao") or ""),
        "lastError": "" if valid else str(last.get("error") or "falhou"),
        "validatedAt": utc_now(),
    }


def main() -> int:
    config = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    entries = [p for p in config.get("proxies", []) if p.get("id") and p.get("template")]
    target = str(config.get("probeTarget") or "").strip()
    marker = str(config.get("probeMarker") or "").strip()
    attempts = max(1, int(config.get("attempts") or 3))
    minimum = max(1, min(attempts, int(config.get("minimumSuccesses") or 2)))
    timeout_s = max(1.0, float(config.get("timeoutMs") or 7000) / 1000.0)

    if not entries or not target or not marker:
        raise SystemExit("proxy-candidates.json incompleto")

    print(f"Validando {len(entries)} proxies CORS contra {target}")
    workers = min(4, len(entries))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(validate_proxy, entry, target, marker, attempts, timeout_s, minimum): entry
            for entry in entries
        }
        results = [future.result() for future in concurrent.futures.as_completed(futures)]

    results.sort(key=lambda r: (
        0 if r["valid"] else 1,
        r["latencyMs"] if r["latencyMs"] is not None else 10**9,
        r["priority"],
        r["id"],
    ))

    for result in results:
        state = "OK" if result["valid"] else "FAIL"
        print(
            f"[{state}] {result['id']}: {result['successes']}/{result['attempts']} "
            f"lat={result['latencyMs']}ms status={result['lastStatus']} "
            f"ACAO={result['corsAllowOrigin']!r} {result['lastError']}"
        )

    valid = [r for r in results if r["valid"]]
    if not valid:
        print("Nenhum proxy CORS passou nesta rodada; publicando pool vazio seguro.")

    published = {
        "revision": f"workflow-{int(time.time())}",
        "generatedAt": utc_now(),
        "sourceRevision": str(config.get("revision") or ""),
        "validator": "github-actions-cors-v1.1",
        "probeTarget": target,
        "candidateCount": len(results),
        "validCount": len(valid),
        "maxApiFallbacks": max(1, int(config.get("maxApiFallbacks") or 2)),
        "proxies": [
            {
                "id": r["id"],
                "name": r["name"],
                "template": r["template"],
                "priority": r["priority"],
                "latencyMs": r["latencyMs"],
                "successRate": r["successRate"],
                "lastStatus": r["lastStatus"],
                "corsAllowOrigin": r["corsAllowOrigin"],
                "validatedAt": r["validatedAt"],
            }
            for r in valid
        ],
    }
    OUTPUT.write_text(json.dumps(published, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Publicado pool com {len(valid)} proxy(s) válido(s): {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

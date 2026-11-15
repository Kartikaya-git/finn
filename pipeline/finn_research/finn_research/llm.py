"""Gemini REST client with on-disk cache, 429 backoff and token accounting."""
import hashlib
import json
import os
import threading
import time

import requests

from .paths import ENV_FILE, LLM_CACHE

# Routing: MAP = cheapest flash-lite (bulk extraction over long transcripts),
# REDUCE = strongest flash (cross-quarter reasoning, once per company).
MAP_MODEL = os.environ.get("FINN_MAP_MODEL", "gemini-3.5-flash-lite")
REDUCE_MODEL = os.environ.get("FINN_REDUCE_MODEL", "gemini-3.8-flash")
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_lock = threading.Lock()
USAGE = {}  # model -> {"calls", "cached", "prompt", "output", "thoughts"}


def _api_key():
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    raise RuntimeError("GEMINI_API_KEY not set (env or .env)")


def _account(model, meta, cached):
    with _lock:
        u = USAGE.setdefault(model, {"calls": 0, "cached": 0, "prompt": 0, "output": 0, "thoughts": 0})
        if cached:
            u["cached"] += 1
            return
        u["calls"] += 1
        u["prompt"] += meta.get("promptTokenCount", 0)
        u["output"] += meta.get("candidatesTokenCount", 0)
        u["thoughts"] += meta.get("thoughtsTokenCount", 0)


def generate_json(model: str, prompt: str, tag: str = "", max_retries: int = 6):
    """Return parsed JSON from the model. Cached by sha1(model+prompt)."""
    LLM_CACHE.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1((model + "\n" + prompt).encode()).hexdigest()
    path = LLM_CACHE / f"{h}.json"
    if path.exists():
        rec = json.loads(path.read_text())
        _account(model, rec.get("usage", {}), cached=True)
        print(f"    llm {tag} [{model}] cache hit", flush=True)
        return rec["output"]
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    wait = 15
    for attempt in range(max_retries):
        t0 = time.time()
        try:
            r = requests.post(URL.format(model=model), json=body, timeout=300,
                              headers={"x-goog-api-key": _api_key()})
        except requests.RequestException as e:
            print(f"    llm {tag} network error ({type(e).__name__}), retry in {wait}s", flush=True)
            time.sleep(wait); wait = min(wait * 2, 120); continue
        if r.status_code in (429, 500, 503):
            print(f"    llm {tag} [{model}] HTTP {r.status_code} rate-limited/overloaded, waiting {wait}s", flush=True)
            time.sleep(wait); wait = min(wait * 2, 120); continue
        if r.status_code != 200:
            raise RuntimeError(f"Gemini {model} HTTP {r.status_code}: {r.text[:200]}")
        d = r.json()
        meta = d.get("usageMetadata", {})
        try:
            text = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])
            out = json.loads(text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"    llm {tag} bad JSON ({type(e).__name__}), retry", flush=True)
            continue
        _account(model, meta, cached=False)
        path.write_text(json.dumps({"model": model, "usage": meta, "output": out}))
        print(f"    llm {tag} [{model}] {meta.get('promptTokenCount',0)} in / "
              f"{meta.get('candidatesTokenCount',0)} out / {meta.get('thoughtsTokenCount',0)} think "
              f"({time.time()-t0:.0f}s)", flush=True)
        return out
    raise RuntimeError(f"Gemini {model} failed after {max_retries} attempts")


def usage_summary():
    lines = ["LLM usage summary:"]
    tot_calls = tot_tok = 0
    for m, u in USAGE.items():
        tok = u["prompt"] + u["output"] + u["thoughts"]
        tot_calls += u["calls"]; tot_tok += tok
        lines.append(f"  {m}: {u['calls']} live calls, {u['cached']} cache hits, "
                     f"{u['prompt']} prompt + {u['output']} output + {u['thoughts']} thinking = {tok} tokens")
    lines.append(f"  TOTAL: {tot_calls} live calls, {tot_tok} tokens; cost Rs 0 (Gemini free tier). "
                 f"Cache: {LLM_CACHE}")
    return "\n".join(lines)

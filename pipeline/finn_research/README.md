# finn_research — generalised research engine (any NSE ticker)

```
cd pipeline/finn_research
uv sync
uv run python -m finn_research ITC INFY --jobs 4
```

Needs `GEMINI_API_KEY` in env or the project-root `.env`; `pdftotext` (poppler) preferred, pypdf fallback.

Pipeline per symbol:
1. screener.in company page (consolidated, fallback standalone) → quarterly table + last 4 concall docs
   (transcript if linked, else the investor presentation PDF). Raw HTML/PDF/text cached in `pipeline/.cache/`.
2. Text → ~150–200-word chunks → `web/public/data/research/{SYMBOL}.chunks.json` (cap 400).
3. MAP (`gemini-3.5-flash-lite`, per document): guidance / claims / segments with verbatim quotes;
   quotes not found in the source text are dropped in code.
4. REDUCE (`gemini-3.8-flash`, once per company): map outputs + quarterly table → `{SYMBOL}.json`
   (SPEC.md contract). Prompt forbids outside knowledge.

Every LLM response is cached at `pipeline/.cache/llm/{sha1(model+prompt)}.json`, so reruns are free.
Override models with `FINN_MAP_MODEL` / `FINN_REDUCE_MODEL`. POLYCAB, KPITTECH, DIXON, PIDILITIND are
hand-written and skipped unless `--force`.

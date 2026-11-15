from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parent.parent          # pipeline/finn_research
PIPELINE = PKG_ROOT.parent                                  # pipeline/
PROJECT = PIPELINE.parent
CACHE = PIPELINE / ".cache"
LLM_CACHE = CACHE / "llm"
SCREENER_CACHE = CACHE / "screener"
PDF_CACHE = CACHE / "pdf"
OUT_DIR = PROJECT / "web" / "public" / "data" / "research"
ENV_FILE = PROJECT / ".env"

# Hand-written research lives here too; never overwrite it.
PROTECTED = {"POLYCAB", "KPITTECH", "DIXON", "PIDILITIND"}

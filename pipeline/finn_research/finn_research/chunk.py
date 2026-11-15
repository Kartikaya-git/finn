import re

def chunk_words(text: str, target=180, max_words=200):
    """Paragraph-aware ~150-200 word chunks."""
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    chunks, cur = [], []
    for p in paras:
        words = p.split()
        while words:
            room = max_words - len(cur)
            cur.extend(words[:room]); words = words[room:]
            if len(cur) >= target:
                chunks.append(" ".join(cur)); cur = []
    if len(cur) > 40 or (cur and not chunks):
        chunks.append(" ".join(cur))
    elif cur:
        chunks[-1] += " " + " ".join(cur)
    return chunks

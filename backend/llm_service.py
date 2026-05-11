"""LLM service wrapping Nebius Token Factory (OpenAI-compatible) for belief extraction,
contradiction detection, crux analysis, and conflict scanning."""
import os
import json
import logging
import re
from typing import List, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=os.environ["LLM_BASE_URL"],
            api_key=os.environ["LLM_API_KEY"],
        )
    return _client


MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")


def _parse_json(text: str) -> dict:
    """Robustly extract JSON from an LLM response (handles fenced code blocks, prose, etc.)."""
    text = text.strip()
    # Try fenced block first
    m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Find first balanced JSON object/array
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == opener:
                depth += 1
            elif text[i] == closer:
                depth -= 1
                if depth == 0:
                    chunk = text[start:i + 1]
                    try:
                        return json.loads(chunk)
                    except Exception:
                        break
    # Fallback: raw parse
    try:
        return json.loads(text)
    except Exception:
        logger.error("Could not parse JSON from LLM: %s", text[:500])
        return {}


def _chat(system: str, user: str, temperature: float = 0.2, max_tokens: int = 1800,
          json_mode: bool = True) -> str:
    kwargs = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        # Nebius (OpenAI-compatible) supports JSON-only response_format
        kwargs["response_format"] = {"type": "json_object"}
    resp = get_client().chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


# ---------- Extraction ----------

EXTRACT_SYSTEM = """You are an epistemic analyst that extracts structured beliefs from natural-text writing.
A belief is an opinion or claim the author is asserting (not facts being reported by others).
For each belief, extract:
- statement: a concise canonical phrasing (one sentence, <=140 chars)
- confidence: integer 0-100 the author seems to hold (use hedging words: "definitely"=>90, "probably"=>70, "maybe"=>50, "unsure"=>35, defaults to 65)
- topic: a short 1-3 word topic tag (lowercase)
- evidence: list of brief evidence/reason quotes from the text supporting the belief (each <=200 chars)
- assumptions: list of implicit upstream assumptions the belief rests on (each <=140 chars, phrased as their own claims)

If the text contains ANY opinion at all, you MUST return at least one belief. Only return an empty list if the text is purely factual reporting with zero opinions.

Return STRICT JSON ONLY in this exact shape: {"beliefs":[{"statement":"...","confidence":75,"topic":"...","evidence":["..."],"assumptions":["..."]}]}
No prose. No markdown fences. Just the JSON object."""


def extract_beliefs(text: str) -> List[dict]:
    user = f"Extract beliefs from this writing:\n\n---\n{text}\n---"
    # First attempt with JSON mode
    raw = _chat(EXTRACT_SYSTEM, user, temperature=0.2, max_tokens=2200, json_mode=True)
    data = _parse_json(raw)
    beliefs = data.get("beliefs", []) if isinstance(data, dict) else []
    # Retry once if empty but text is non-trivial
    if not beliefs and len(text) > 20:
        logger.warning("extract_beliefs: empty result, retrying with stricter prompt")
        retry_user = (
            f"The following text contains at least one opinion. Extract every belief you can find.\n"
            f"Return JSON: {{\"beliefs\":[...]}}\n\n---\n{text}\n---"
        )
        raw2 = _chat(EXTRACT_SYSTEM, retry_user, temperature=0.4, max_tokens=2200, json_mode=True)
        data2 = _parse_json(raw2)
        beliefs = data2.get("beliefs", []) if isinstance(data2, dict) else []
    cleaned = []
    for b in beliefs:
        if not isinstance(b, dict) or not b.get("statement"):
            continue
        cleaned.append({
            "statement": str(b.get("statement", "")).strip()[:240],
            "confidence": max(0, min(100, int(b.get("confidence", 65) or 65))),
            "topic": str(b.get("topic", "general") or "general").lower().strip()[:40],
            "evidence": [str(e).strip()[:300] for e in (b.get("evidence") or []) if e][:6],
            "assumptions": [str(a).strip()[:200] for a in (b.get("assumptions") or []) if a][:5],
        })
    return cleaned


# ---------- Contradiction / similarity matching ----------

MATCH_SYSTEM = """You compare a NEW belief against a list of EXISTING beliefs and classify the relationship.
For each existing belief, decide if it is:
- "duplicate": same claim (merge them)
- "contradiction": directly conflicts (cannot both be true)
- "supports": new belief reinforces existing
- "depends_on": new belief logically depends on existing (existing is a precondition / upstream assumption of new)
- "unrelated"

Return STRICT JSON: {"matches":[{"id":"<existing belief id>", "relation":"duplicate|contradiction|supports|depends_on|unrelated", "reason":"<one short sentence>"}]}
Only include items with relation != "unrelated". No prose, no fences."""


def classify_relationships(new_belief: dict, existing: List[dict]) -> List[dict]:
    if not existing:
        return []
    # Cap existing to keep prompt small
    capped = existing[:60]
    listing = "\n".join(f"- id={b['id']} | conf={b['confidence']} | {b['statement']}" for b in capped)
    user = (
        f"NEW BELIEF:\nstatement: {new_belief['statement']}\nconfidence: {new_belief['confidence']}\n"
        f"topic: {new_belief.get('topic','')}\nassumptions: {new_belief.get('assumptions', [])}\n\n"
        f"EXISTING BELIEFS:\n{listing}\n\nClassify."
    )
    raw = _chat(MATCH_SYSTEM, user, temperature=0.1, max_tokens=1500)
    data = _parse_json(raw)
    matches = data.get("matches", []) if isinstance(data, dict) else []
    out = []
    valid = {"duplicate", "contradiction", "supports", "depends_on"}
    existing_ids = {b["id"] for b in existing}
    for m in matches:
        if not isinstance(m, dict):
            continue
        rid = str(m.get("id", ""))
        rel = str(m.get("relation", "")).lower()
        if rid in existing_ids and rel in valid:
            out.append({"id": rid, "relation": rel, "reason": str(m.get("reason", ""))[:280]})
    return out


# ---------- Crux ----------

CRUX_SYSTEM = """You identify CRUXES for a belief: the 2-3 upstream assumptions whose falsification
would most change the author's mind. For each crux, suggest a falsifier — a concrete observation
that would disconfirm it.

Return STRICT JSON: {"cruxes":[{"assumption":"...", "falsifier":"...", "importance":1-10}, ...]}
Max 3 entries. No prose, no fences."""


def compute_crux(belief: dict, upstream: List[dict]) -> List[dict]:
    upstream_text = "\n".join(f"- {b['statement']} (conf={b['confidence']})" for b in upstream) or "(none recorded yet)"
    user = (
        f"BELIEF: {belief['statement']} (conf={belief['confidence']})\n"
        f"AUTHOR-STATED ASSUMPTIONS: {belief.get('assumptions', [])}\n"
        f"UPSTREAM RECORDED BELIEFS:\n{upstream_text}\n\n"
        "Identify the 2-3 most load-bearing cruxes."
    )
    raw = _chat(CRUX_SYSTEM, user, temperature=0.3, max_tokens=900)
    data = _parse_json(raw)
    items = data.get("cruxes", []) if isinstance(data, dict) else []
    out = []
    for c in items[:3]:
        if not isinstance(c, dict):
            continue
        out.append({
            "assumption": str(c.get("assumption", ""))[:240],
            "falsifier": str(c.get("falsifier", ""))[:280],
            "importance": max(1, min(10, int(c.get("importance", 5) or 5))),
        })
    return out


# ---------- Scanner ----------

SCAN_SYSTEM = """You are reviewing an external article/conversation against the user's stored beliefs.
Extract claims from the input that EITHER conflict with or strongly support the user's beliefs.
Prioritize conflicts. Ignore neutral/unrelated content.

For each flagged claim, identify which stored belief it touches and how.

Return STRICT JSON: {"claims":[{"quote":"<verbatim or close paraphrase, <=240 chars>", "belief_id":"<id>", "relation":"conflict|support", "severity":1-10, "explanation":"<one short sentence>"}]}
Max 12 entries. Sort by severity descending. No prose, no fences."""


def scan_article(article: str, beliefs: List[dict]) -> List[dict]:
    if not beliefs:
        return []
    listing = "\n".join(f"- id={b['id']} | conf={b['confidence']} | centrality={b.get('centrality',0)} | {b['statement']}" for b in beliefs[:80])
    user = f"USER BELIEFS:\n{listing}\n\nINPUT ARTICLE / CONVERSATION:\n---\n{article[:6000]}\n---"
    raw = _chat(SCAN_SYSTEM, user, temperature=0.2, max_tokens=2000)
    data = _parse_json(raw)
    items = data.get("claims", []) if isinstance(data, dict) else []
    valid_ids = {b["id"] for b in beliefs}
    out = []
    for c in items:
        if not isinstance(c, dict):
            continue
        bid = str(c.get("belief_id", ""))
        rel = str(c.get("relation", "")).lower()
        if bid not in valid_ids or rel not in ("conflict", "support"):
            continue
        out.append({
            "quote": str(c.get("quote", ""))[:280],
            "belief_id": bid,
            "relation": rel,
            "severity": max(1, min(10, int(c.get("severity", 5) or 5))),
            "explanation": str(c.get("explanation", ""))[:300],
        })
    out.sort(key=lambda x: x["severity"], reverse=True)
    return out[:12]

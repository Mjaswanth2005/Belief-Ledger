"""Belief Ledger backend — FastAPI + MongoDB.

Endpoints (all /api prefixed):
- POST   /api/entries              submit raw text, returns extracted beliefs + relationships
- GET    /api/entries              list raw entries
- GET    /api/beliefs              list all beliefs (with derived centrality)
- GET    /api/beliefs/{id}         single belief detail (with upstream/downstream)
- DELETE /api/beliefs/{id}         remove a belief
- POST   /api/beliefs/{id}/crux    compute crux for a belief
- GET    /api/ledger               chronological revisions (git-log style)
- GET    /api/graph                {nodes, links} for force-directed graph
- POST   /api/scan                 scan an article against beliefs for conflicts
- DELETE /api/reset                wipe everything (dev convenience)
"""
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import secrets
from datetime import datetime, timezone

import llm_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Belief Ledger")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)


# ---------- Models ----------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def short_hash() -> str:
    return secrets.token_hex(3)  # 6 chars


class EntryIn(BaseModel):
    text: str


class ScanIn(BaseModel):
    text: str


class Belief(BaseModel):
    id: str
    statement: str
    confidence: int
    topic: str
    evidence: List[str] = []
    assumptions: List[str] = []
    created_at: str
    updated_at: str
    revisions: int = 1
    short_id: str


class Revision(BaseModel):
    id: str
    belief_id: str
    short_id: str
    kind: str  # created | confidence_shift | merge | dependency_added | contradiction | evidence_added
    summary: str
    prev_confidence: Optional[int] = None
    new_confidence: Optional[int] = None
    related_belief_id: Optional[str] = None
    created_at: str


# ---------- Helpers ----------

async def _list_beliefs() -> List[dict]:
    return await db.beliefs.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)


async def _list_dependencies() -> List[dict]:
    return await db.dependencies.find({}, {"_id": 0}).to_list(5000)


async def _centrality_map() -> dict:
    """Centrality = in-degree (how many beliefs depend ON this one) + 0.5 * out-degree."""
    deps = await _list_dependencies()
    in_deg, out_deg = {}, {}
    for d in deps:
        # dependent -> depends_on  (dependent rests on depends_on)
        in_deg[d["depends_on"]] = in_deg.get(d["depends_on"], 0) + 1
        out_deg[d["dependent"]] = out_deg.get(d["dependent"], 0) + 1
    cent = {}
    all_ids = set(in_deg) | set(out_deg)
    for bid in all_ids:
        cent[bid] = in_deg.get(bid, 0) + 0.5 * out_deg.get(bid, 0)
    return cent


async def _record_revision(belief_id: str, short_id: str, kind: str, summary: str,
                           prev_conf: Optional[int] = None, new_conf: Optional[int] = None,
                           related: Optional[str] = None):
    rev = {
        "id": str(uuid.uuid4()),
        "belief_id": belief_id,
        "short_id": short_id,
        "kind": kind,
        "summary": summary,
        "prev_confidence": prev_conf,
        "new_confidence": new_conf,
        "related_belief_id": related,
        "created_at": now_iso(),
    }
    await db.revisions.insert_one(dict(rev))
    rev.pop("_id", None)
    return rev


# ---------- Routes ----------

@api.get("/")
async def root():
    return {"service": "belief-ledger", "ok": True}


@api.post("/entries")
async def create_entry(payload: EntryIn):
    text = (payload.text or "").strip()
    if len(text) < 5:
        raise HTTPException(400, "Entry too short")

    entry_id = str(uuid.uuid4())
    entry_doc = {
        "id": entry_id,
        "text": text,
        "created_at": now_iso(),
    }
    await db.entries.insert_one(dict(entry_doc))

    try:
        extracted = llm_service.extract_beliefs(text)
    except Exception as e:
        log.exception("extract_beliefs failed")
        raise HTTPException(502, f"LLM extraction failed: {e}")

    existing = await _list_beliefs()
    results = []  # per new belief: {belief, relationships, action}

    for ex in extracted:
        # Classify against existing
        try:
            rels = llm_service.classify_relationships(ex, existing)
        except Exception:
            log.exception("classify_relationships failed")
            rels = []

        duplicate_id = next((r["id"] for r in rels if r["relation"] == "duplicate"), None)

        if duplicate_id:
            target = await db.beliefs.find_one({"id": duplicate_id}, {"_id": 0})
            if target:
                prev_conf = target["confidence"]
                # Weighted avg: pull confidence toward new evidence
                new_conf = int(round(0.6 * prev_conf + 0.4 * ex["confidence"]))
                new_evidence = list({*target.get("evidence", []), *ex.get("evidence", [])})[:10]
                new_assumptions = list({*target.get("assumptions", []), *ex.get("assumptions", [])})[:8]
                await db.beliefs.update_one(
                    {"id": duplicate_id},
                    {"$set": {
                        "confidence": new_conf,
                        "evidence": new_evidence,
                        "assumptions": new_assumptions,
                        "updated_at": now_iso(),
                    }, "$inc": {"revisions": 1}}
                )
                if new_conf != prev_conf:
                    await _record_revision(
                        duplicate_id, target["short_id"], "confidence_shift",
                        f"merged new evidence; confidence {prev_conf}% → {new_conf}%",
                        prev_conf=prev_conf, new_conf=new_conf,
                    )
                else:
                    await _record_revision(
                        duplicate_id, target["short_id"], "evidence_added",
                        "merged duplicate phrasing; added evidence",
                    )
                merged = await db.beliefs.find_one({"id": duplicate_id}, {"_id": 0})
                results.append({"belief": merged, "relationships": rels, "action": "merged"})
                # Refresh existing
                existing = await _list_beliefs()
                continue

        # Create new belief
        bid = str(uuid.uuid4())
        sid = "blf_" + short_hash()
        new_doc = {
            "id": bid,
            "short_id": sid,
            "statement": ex["statement"],
            "confidence": ex["confidence"],
            "topic": ex["topic"],
            "evidence": ex["evidence"],
            "assumptions": ex["assumptions"],
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "revisions": 1,
            "source_entry_id": entry_id,
        }
        await db.beliefs.insert_one(dict(new_doc))
        await _record_revision(bid, sid, "created", f"new belief: {ex['statement'][:120]}",
                               new_conf=ex["confidence"])

        # Record dependencies & contradictions
        for r in rels:
            if r["relation"] == "depends_on":
                await db.dependencies.insert_one({
                    "id": str(uuid.uuid4()),
                    "dependent": bid,
                    "depends_on": r["id"],
                    "kind": "depends_on",
                    "created_at": now_iso(),
                })
                target = next((b for b in existing if b["id"] == r["id"]), None)
                if target:
                    await _record_revision(bid, sid, "dependency_added",
                                           f"depends on {target['short_id']}: {r['reason'][:140]}",
                                           related=r["id"])
            elif r["relation"] == "contradiction":
                await db.dependencies.insert_one({
                    "id": str(uuid.uuid4()),
                    "dependent": bid,
                    "depends_on": r["id"],
                    "kind": "contradicts",
                    "created_at": now_iso(),
                })
                target = next((b for b in existing if b["id"] == r["id"]), None)
                if target:
                    await _record_revision(bid, sid, "contradiction",
                                           f"contradicts {target['short_id']}: {r['reason'][:140]}",
                                           related=r["id"])
            elif r["relation"] == "supports":
                await db.dependencies.insert_one({
                    "id": str(uuid.uuid4()),
                    "dependent": bid,
                    "depends_on": r["id"],
                    "kind": "supports",
                    "created_at": now_iso(),
                })

        results.append({"belief": new_doc, "relationships": rels, "action": "created"})
        existing = await _list_beliefs()

    return {"entry_id": entry_id, "results": results, "count": len(results)}


@api.get("/entries")
async def list_entries():
    rows = await db.entries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api.get("/beliefs")
async def get_beliefs():
    beliefs = await _list_beliefs()
    cent = await _centrality_map()
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    return beliefs


@api.get("/beliefs/{belief_id}")
async def get_belief(belief_id: str):
    b = await db.beliefs.find_one({"id": belief_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Belief not found")
    deps = await _list_dependencies()
    beliefs = await _list_beliefs()
    by_id = {x["id"]: x for x in beliefs}

    upstream = []
    downstream = []
    contradictions = []
    supports = []
    for d in deps:
        if d["dependent"] == belief_id and d["depends_on"] in by_id:
            target = by_id[d["depends_on"]]
            kind = d.get("kind", "depends_on")
            if kind == "depends_on":
                upstream.append(target)
            elif kind == "contradicts":
                contradictions.append(target)
            elif kind == "supports":
                supports.append(target)
        elif d["depends_on"] == belief_id and d["dependent"] in by_id:
            downstream.append({**by_id[d["dependent"]], "_rel": d.get("kind", "depends_on")})

    revs = await db.revisions.find({"belief_id": belief_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    cent = await _centrality_map()
    b["centrality"] = round(cent.get(belief_id, 0), 2)
    return {
        "belief": b,
        "upstream": upstream,
        "downstream": downstream,
        "contradictions": contradictions,
        "supports": supports,
        "revisions": revs,
    }


@api.delete("/beliefs/{belief_id}")
async def delete_belief(belief_id: str):
    res = await db.beliefs.delete_one({"id": belief_id})
    await db.dependencies.delete_many({"$or": [{"dependent": belief_id}, {"depends_on": belief_id}]})
    await db.revisions.delete_many({"belief_id": belief_id})
    return {"deleted": res.deleted_count}


@api.post("/beliefs/{belief_id}/crux")
async def belief_crux(belief_id: str):
    b = await db.beliefs.find_one({"id": belief_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Belief not found")
    deps = await _list_dependencies()
    upstream_ids = [d["depends_on"] for d in deps if d["dependent"] == belief_id and d.get("kind") == "depends_on"]
    upstream = await db.beliefs.find({"id": {"$in": upstream_ids}}, {"_id": 0}).to_list(50) if upstream_ids else []
    try:
        cruxes = llm_service.compute_crux(b, upstream)
    except Exception as e:
        log.exception("compute_crux failed")
        raise HTTPException(502, f"LLM crux failed: {e}")
    # Store latest cruxes
    await db.beliefs.update_one({"id": belief_id}, {"$set": {"cruxes": cruxes, "cruxes_at": now_iso()}})
    return {"belief_id": belief_id, "cruxes": cruxes}


@api.get("/ledger")
async def get_ledger():
    revs = await db.revisions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    beliefs = {b["id"]: b for b in await _list_beliefs()}
    for r in revs:
        b = beliefs.get(r["belief_id"])
        r["statement"] = b["statement"] if b else "(deleted)"
        r["topic"] = b["topic"] if b else ""
    return revs


@api.get("/graph")
async def get_graph():
    beliefs = await _list_beliefs()
    deps = await _list_dependencies()
    cent = await _centrality_map()
    nodes = [{
        "id": b["id"],
        "short_id": b["short_id"],
        "label": b["statement"],
        "confidence": b["confidence"],
        "topic": b["topic"],
        "centrality": round(cent.get(b["id"], 0), 2),
    } for b in beliefs]
    links = [{
        "source": d["dependent"],
        "target": d["depends_on"],
        "kind": d.get("kind", "depends_on"),
    } for d in deps]
    return {"nodes": nodes, "links": links}


@api.post("/scan")
async def scan(payload: ScanIn):
    text = (payload.text or "").strip()
    if len(text) < 20:
        raise HTTPException(400, "Article too short to scan")
    beliefs = await _list_beliefs()
    if not beliefs:
        return {"claims": [], "note": "no beliefs to scan against yet"}
    cent = await _centrality_map()
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    try:
        claims = llm_service.scan_article(text, beliefs)
    except Exception as e:
        log.exception("scan_article failed")
        raise HTTPException(502, f"LLM scan failed: {e}")
    # Enrich with belief data + ranked score (severity * (1+centrality))
    by_id = {b["id"]: b for b in beliefs}
    for c in claims:
        b = by_id.get(c["belief_id"])
        if b:
            c["belief"] = {"id": b["id"], "short_id": b["short_id"], "statement": b["statement"],
                           "confidence": b["confidence"], "centrality": b["centrality"]}
            c["score"] = round(c["severity"] * (1 + b["centrality"]), 2)
        else:
            c["score"] = c["severity"]
    claims.sort(key=lambda x: x["score"], reverse=True)
    return {"claims": claims}


@api.delete("/reset")
async def reset_all():
    for coll in ("entries", "beliefs", "dependencies", "revisions"):
        await db[coll].delete_many({})
    return {"reset": True}


@api.get("/cruxes")
async def top_cruxes(limit: int = 5):
    """Top-N beliefs ranked by centrality × revision-volatility (proxy: 1 + revisions),
    then by confidence. Falls back to centrality-only when ledger is small."""
    beliefs = await _list_beliefs()
    cent = await _centrality_map()
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    # score: prioritize beliefs that are both load-bearing and have moved (revisions > 1)
    beliefs.sort(
        key=lambda b: (
            b["centrality"] * (1 + 0.5 * max(0, b.get("revisions", 1) - 1)),
            b["confidence"],
        ),
        reverse=True,
    )
    top = beliefs[:limit]
    out = []
    deps = await _list_dependencies()
    for b in top:
        cruxes = b.get("cruxes")
        if not cruxes:
            upstream_ids = [d["depends_on"] for d in deps if d["dependent"] == b["id"] and d.get("kind") == "depends_on"]
            upstream = await db.beliefs.find({"id": {"$in": upstream_ids}}, {"_id": 0}).to_list(50) if upstream_ids else []
            try:
                cruxes = llm_service.compute_crux(b, upstream)
                await db.beliefs.update_one({"id": b["id"]}, {"$set": {"cruxes": cruxes, "cruxes_at": now_iso()}})
            except Exception:
                log.exception("compute_crux failed in top_cruxes")
                cruxes = []
        out.append({
            "id": b["id"],
            "short_id": b["short_id"],
            "statement": b["statement"],
            "confidence": b["confidence"],
            "centrality": b["centrality"],
            "topic": b["topic"],
            "cruxes": cruxes or [],
        })
    return {"items": out}


@api.get("/beliefs/{belief_id}/ripple")
async def belief_ripple(belief_id: str):
    """All beliefs whose stance would be affected if this belief changes."""
    b = await db.beliefs.find_one({"id": belief_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Belief not found")
    deps = await _list_dependencies()
    beliefs = {x["id"]: x for x in await _list_beliefs()}
    # BFS over reverse edges (depends_on points root→leaf? In our schema, dep.dependent depends on dep.depends_on,
    # so children of `belief_id` are those rows where depends_on == belief_id)
    visited, queue, ripple = {belief_id}, [belief_id], []
    while queue:
        cur = queue.pop(0)
        for d in deps:
            if d["depends_on"] == cur and d["dependent"] not in visited:
                visited.add(d["dependent"])
                target = beliefs.get(d["dependent"])
                if target:
                    ripple.append({**target, "_rel": d.get("kind", "depends_on"), "_via": cur})
                    queue.append(d["dependent"])
    return {"belief_id": belief_id, "ripple": ripple, "count": len(ripple)}


DEMO_ENTRIES = [
    "I'm convinced remote work is better for all engineers. Async communication forces clarity, and you ship more without the constant interruption of an open office.",
    "Honestly though, junior engineers really need in-person mentorship to grow. They absorb how senior people debug just by overhearing it, and that's irreplaceable.",
    "Compound interest is the single most underrated force in personal finance. People can't internalize exponential curves, which is exactly why most folks underinvest in their 20s.",
    "Most startup advice is survivorship bias. The reason one founder's tactic worked rarely generalizes because the base rates that would let you judge it are hidden.",
]


@api.post("/seed-demo")
async def seed_demo():
    """Seed 3-4 example beliefs with real LLM extraction so user sees structure immediately."""
    for coll in ("entries", "beliefs", "dependencies", "revisions"):
        await db[coll].delete_many({})
    total = 0
    for text in DEMO_ENTRIES:
        try:
            res = await create_entry(EntryIn(text=text))
            total += res.get("count", 0)
        except Exception:
            log.exception("seed entry failed")
    return {"seeded_beliefs": total, "entries": len(DEMO_ENTRIES)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

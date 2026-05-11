"""Belief Ledger backend — FastAPI + Supabase Postgres (async SQLAlchemy)."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
import secrets
from datetime import datetime, timezone

import llm_service
from database import AsyncSessionLocal, get_db
from models import Entry, Belief, Dependency, Revision

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Belief Ledger")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log = logging.getLogger(__name__)


# ---------- Helpers ----------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def short_hash() -> str:
    return secrets.token_hex(3)


def belief_to_dict(b: Belief) -> dict:
    return {
        "id": b.id,
        "short_id": b.short_id,
        "statement": b.statement,
        "confidence": b.confidence,
        "topic": b.topic,
        "evidence": list(b.evidence or []),
        "assumptions": list(b.assumptions or []),
        "cruxes": list(b.cruxes) if b.cruxes else None,
        "cruxes_at": b.cruxes_at,
        "created_at": b.created_at,
        "updated_at": b.updated_at,
        "revisions": b.revisions,
        "source_entry_id": b.source_entry_id,
    }


def dep_to_dict(d: Dependency) -> dict:
    return {
        "id": d.id,
        "dependent": d.dependent,
        "depends_on": d.depends_on,
        "kind": d.kind,
        "created_at": d.created_at,
    }


def rev_to_dict(r: Revision) -> dict:
    return {
        "id": r.id,
        "belief_id": r.belief_id,
        "short_id": r.short_id,
        "kind": r.kind,
        "summary": r.summary,
        "prev_confidence": r.prev_confidence,
        "new_confidence": r.new_confidence,
        "related_belief_id": r.related_belief_id,
        "created_at": r.created_at,
    }


# ---------- Request models ----------

class EntryIn(BaseModel):
    text: str


class ScanIn(BaseModel):
    text: str


# ---------- DB helpers ----------

async def _list_beliefs(db: AsyncSession) -> List[dict]:
    res = await db.execute(select(Belief).order_by(Belief.updated_at.desc()).limit(1000))
    return [belief_to_dict(b) for b in res.scalars().all()]


async def _list_dependencies(db: AsyncSession) -> List[dict]:
    res = await db.execute(select(Dependency).limit(5000))
    return [dep_to_dict(d) for d in res.scalars().all()]


async def _centrality_map(db: AsyncSession) -> dict:
    deps = await _list_dependencies(db)
    in_deg, out_deg = {}, {}
    for d in deps:
        in_deg[d["depends_on"]] = in_deg.get(d["depends_on"], 0) + 1
        out_deg[d["dependent"]] = out_deg.get(d["dependent"], 0) + 1
    cent = {}
    for bid in set(in_deg) | set(out_deg):
        cent[bid] = in_deg.get(bid, 0) + 0.5 * out_deg.get(bid, 0)
    return cent


async def _record_revision(db: AsyncSession, belief_id: str, short_id: str, kind: str, summary: str,
                           prev_conf: Optional[int] = None, new_conf: Optional[int] = None,
                           related: Optional[str] = None):
    rev = Revision(
        id=str(uuid.uuid4()),
        belief_id=belief_id,
        short_id=short_id,
        kind=kind,
        summary=summary,
        prev_confidence=prev_conf,
        new_confidence=new_conf,
        related_belief_id=related,
        created_at=now_iso(),
    )
    db.add(rev)


# ---------- Routes ----------

@api.get("/")
async def root():
    return {"service": "belief-ledger", "ok": True}


@api.post("/entries")
async def create_entry(payload: EntryIn, db: AsyncSession = Depends(get_db)):
    text = (payload.text or "").strip()
    if len(text) < 5:
        raise HTTPException(400, "Entry too short")

    entry_id = str(uuid.uuid4())
    db.add(Entry(id=entry_id, text=text, created_at=now_iso()))
    await db.flush()

    try:
        extracted = llm_service.extract_beliefs(text)
    except Exception as e:
        log.exception("extract_beliefs failed")
        raise HTTPException(502, f"LLM extraction failed: {e}")

    existing = await _list_beliefs(db)
    results = []

    for ex in extracted:
        try:
            rels = llm_service.classify_relationships(ex, existing)
        except Exception:
            log.exception("classify_relationships failed")
            rels = []

        duplicate_id = next((r["id"] for r in rels if r["relation"] == "duplicate"), None)

        if duplicate_id:
            target_row = await db.get(Belief, duplicate_id)
            if target_row:
                prev_conf = target_row.confidence
                new_conf = int(round(0.6 * prev_conf + 0.4 * ex["confidence"]))
                new_evidence = list({*(target_row.evidence or []), *ex.get("evidence", [])})[:10]
                new_assumptions = list({*(target_row.assumptions or []), *ex.get("assumptions", [])})[:8]
                target_row.confidence = new_conf
                target_row.evidence = new_evidence
                target_row.assumptions = new_assumptions
                target_row.updated_at = now_iso()
                target_row.revisions = (target_row.revisions or 1) + 1
                if new_conf != prev_conf:
                    await _record_revision(
                        db, duplicate_id, target_row.short_id, "confidence_shift",
                        f"merged new evidence; confidence {prev_conf}% → {new_conf}%",
                        prev_conf=prev_conf, new_conf=new_conf,
                    )
                else:
                    await _record_revision(
                        db, duplicate_id, target_row.short_id, "evidence_added",
                        "merged duplicate phrasing; added evidence",
                    )
                await db.flush()
                results.append({"belief": belief_to_dict(target_row), "relationships": rels, "action": "merged"})
                existing = await _list_beliefs(db)
                continue

        # Create new belief
        bid = str(uuid.uuid4())
        sid = "blf_" + short_hash()
        new_row = Belief(
            id=bid,
            short_id=sid,
            statement=ex["statement"],
            confidence=ex["confidence"],
            topic=ex["topic"],
            evidence=ex["evidence"],
            assumptions=ex["assumptions"],
            created_at=now_iso(),
            updated_at=now_iso(),
            revisions=1,
            source_entry_id=entry_id,
        )
        db.add(new_row)
        await db.flush()
        await _record_revision(db, bid, sid, "created",
                               f"new belief: {ex['statement'][:120]}", new_conf=ex["confidence"])

        for r in rels:
            if r["relation"] in ("depends_on", "contradiction", "supports"):
                kind = {"depends_on": "depends_on", "contradiction": "contradicts", "supports": "supports"}[r["relation"]]
                db.add(Dependency(
                    id=str(uuid.uuid4()),
                    dependent=bid,
                    depends_on=r["id"],
                    kind=kind,
                    created_at=now_iso(),
                ))
                if r["relation"] == "depends_on":
                    target = next((b for b in existing if b["id"] == r["id"]), None)
                    if target:
                        await _record_revision(db, bid, sid, "dependency_added",
                                               f"depends on {target['short_id']}: {r['reason'][:140]}",
                                               related=r["id"])
                elif r["relation"] == "contradiction":
                    target = next((b for b in existing if b["id"] == r["id"]), None)
                    if target:
                        await _record_revision(db, bid, sid, "contradiction",
                                               f"contradicts {target['short_id']}: {r['reason'][:140]}",
                                               related=r["id"])
        await db.flush()
        results.append({"belief": belief_to_dict(new_row), "relationships": rels, "action": "created"})
        existing = await _list_beliefs(db)

    await db.commit()
    return {"entry_id": entry_id, "results": results, "count": len(results)}


@api.get("/entries")
async def list_entries(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Entry).order_by(Entry.created_at.desc()).limit(500))
    return [{"id": e.id, "text": e.text, "created_at": e.created_at} for e in res.scalars().all()]


@api.get("/beliefs")
async def get_beliefs(db: AsyncSession = Depends(get_db)):
    beliefs = await _list_beliefs(db)
    cent = await _centrality_map(db)
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    return beliefs


@api.get("/beliefs/{belief_id}")
async def get_belief(belief_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Belief, belief_id)
    if not row:
        raise HTTPException(404, "Belief not found")
    b = belief_to_dict(row)
    deps = await _list_dependencies(db)
    beliefs = await _list_beliefs(db)
    by_id = {x["id"]: x for x in beliefs}

    upstream, downstream, contradictions, supports = [], [], [], []
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

    res = await db.execute(
        select(Revision).where(Revision.belief_id == belief_id).order_by(Revision.created_at.desc()).limit(100)
    )
    revs = [rev_to_dict(r) for r in res.scalars().all()]
    cent = await _centrality_map(db)
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
async def delete_belief(belief_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Belief, belief_id)
    if not row:
        return {"deleted": 0}
    await db.delete(row)  # cascade removes deps + revisions
    await db.commit()
    return {"deleted": 1}


@api.post("/beliefs/{belief_id}/crux")
async def belief_crux(belief_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Belief, belief_id)
    if not row:
        raise HTTPException(404, "Belief not found")
    b = belief_to_dict(row)
    res = await db.execute(
        select(Dependency).where(Dependency.dependent == belief_id, Dependency.kind == "depends_on")
    )
    upstream_ids = [d.depends_on for d in res.scalars().all()]
    upstream = []
    if upstream_ids:
        res2 = await db.execute(select(Belief).where(Belief.id.in_(upstream_ids)))
        upstream = [belief_to_dict(x) for x in res2.scalars().all()]
    try:
        cruxes = llm_service.compute_crux(b, upstream)
    except Exception as e:
        log.exception("compute_crux failed")
        raise HTTPException(502, f"LLM crux failed: {e}")
    row.cruxes = cruxes
    row.cruxes_at = now_iso()
    await db.commit()
    return {"belief_id": belief_id, "cruxes": cruxes}


@api.get("/ledger")
async def get_ledger(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Revision).order_by(Revision.created_at.desc()).limit(500))
    revs = [rev_to_dict(r) for r in res.scalars().all()]
    beliefs = {b["id"]: b for b in await _list_beliefs(db)}
    for r in revs:
        b = beliefs.get(r["belief_id"])
        r["statement"] = b["statement"] if b else "(deleted)"
        r["topic"] = b["topic"] if b else ""
    return revs


@api.get("/graph")
async def get_graph(db: AsyncSession = Depends(get_db)):
    beliefs = await _list_beliefs(db)
    deps = await _list_dependencies(db)
    cent = await _centrality_map(db)
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
async def scan(payload: ScanIn, db: AsyncSession = Depends(get_db)):
    text = (payload.text or "").strip()
    if len(text) < 20:
        raise HTTPException(400, "Article too short to scan")
    beliefs = await _list_beliefs(db)
    if not beliefs:
        return {"claims": [], "note": "no beliefs to scan against yet"}
    cent = await _centrality_map(db)
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    try:
        claims = llm_service.scan_article(text, beliefs)
    except Exception as e:
        log.exception("scan_article failed")
        raise HTTPException(502, f"LLM scan failed: {e}")
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
async def reset_all(db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Revision))
    await db.execute(delete(Dependency))
    await db.execute(delete(Belief))
    await db.execute(delete(Entry))
    await db.commit()
    return {"reset": True}


@api.get("/cruxes")
async def top_cruxes(limit: int = 5, db: AsyncSession = Depends(get_db)):
    beliefs = await _list_beliefs(db)
    cent = await _centrality_map(db)
    for b in beliefs:
        b["centrality"] = round(cent.get(b["id"], 0), 2)
    beliefs.sort(
        key=lambda b: (
            b["centrality"] * (1 + 0.5 * max(0, b.get("revisions", 1) - 1)),
            b["confidence"],
        ),
        reverse=True,
    )
    top = beliefs[:limit]
    out = []
    for b in top:
        cruxes = b.get("cruxes")
        if not cruxes:
            res = await db.execute(
                select(Dependency).where(Dependency.dependent == b["id"], Dependency.kind == "depends_on")
            )
            upstream_ids = [d.depends_on for d in res.scalars().all()]
            upstream = []
            if upstream_ids:
                res2 = await db.execute(select(Belief).where(Belief.id.in_(upstream_ids)))
                upstream = [belief_to_dict(x) for x in res2.scalars().all()]
            try:
                cruxes = llm_service.compute_crux(b, upstream)
                row = await db.get(Belief, b["id"])
                if row:
                    row.cruxes = cruxes
                    row.cruxes_at = now_iso()
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
    await db.commit()
    return {"items": out}


@api.get("/beliefs/{belief_id}/ripple")
async def belief_ripple(belief_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Belief, belief_id)
    if not row:
        raise HTTPException(404, "Belief not found")
    deps = await _list_dependencies(db)
    beliefs = {x["id"]: x for x in await _list_beliefs(db)}
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
    # Wipe via an isolated session
    async with AsyncSessionLocal() as s:
        await s.execute(delete(Revision))
        await s.execute(delete(Dependency))
        await s.execute(delete(Belief))
        await s.execute(delete(Entry))
        await s.commit()

    total = 0
    for text in DEMO_ENTRIES:
        try:
            async with AsyncSessionLocal() as s:
                res = await create_entry(EntryIn(text=text), s)
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

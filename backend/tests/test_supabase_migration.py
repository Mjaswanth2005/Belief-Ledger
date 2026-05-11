"""Iteration-3 specific tests verifying Supabase migration behaviours
(cascade delete, JSONB fields, contradicts/supports edge kinds, multi-session seed)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://conviction-graph.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    yield s
    s.delete(f"{API}/reset", timeout=30)


@pytest.fixture(scope="module", autouse=True)
def clean(session):
    r = session.delete(f"{API}/reset", timeout=30)
    assert r.status_code == 200


# --- JSONB serialisation: evidence/assumptions returned as JSON arrays ---
def test_jsonb_fields_serialize_as_lists(session):
    r = session.post(
        f"{API}/entries",
        json={"text": "I strongly believe daily exercise dramatically improves cognitive function and energy levels for knowledge workers."},
        timeout=90,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    b = data["results"][0]["belief"]
    assert isinstance(b["evidence"], list)
    assert isinstance(b["assumptions"], list)
    # round-trip through GET
    rg = session.get(f"{API}/beliefs/{b['id']}", timeout=30)
    assert rg.status_code == 200
    rb = rg.json()["belief"]
    assert isinstance(rb["evidence"], list)
    assert isinstance(rb["assumptions"], list)


# --- Cascade delete: FK ondelete=CASCADE removes deps + revisions ---
def test_cascade_delete_removes_dependencies_and_revisions(session):
    # Reset then create two contradictory beliefs to get at least one dependency row
    session.delete(f"{API}/reset", timeout=30)
    r1 = session.post(
        f"{API}/entries",
        json={"text": "Remote work is unquestionably better for engineering productivity because async focus blocks compound."},
        timeout=120,
    )
    assert r1.status_code == 200, r1.text
    r2 = session.post(
        f"{API}/entries",
        json={"text": "Remote work is clearly hurting engineering productivity; in-person collaboration is essential for shipping fast."},
        timeout=120,
    )
    assert r2.status_code == 200, r2.text

    time.sleep(1)
    graph = session.get(f"{API}/graph", timeout=30).json()
    assert len(graph["nodes"]) >= 2
    # Pick belief with at least one link if present, else any
    target_id = None
    for link in graph["links"]:
        target_id = link["source"]
        break
    if not target_id:
        target_id = graph["nodes"][0]["id"]

    # Delete it; should cascade
    rd = session.delete(f"{API}/beliefs/{target_id}", timeout=30)
    assert rd.status_code == 200
    assert rd.json()["deleted"] == 1

    # Verify belief gone
    rg = session.get(f"{API}/beliefs/{target_id}", timeout=15)
    assert rg.status_code == 404

    # Verify no remaining links reference the deleted belief
    graph2 = session.get(f"{API}/graph", timeout=30).json()
    for link in graph2["links"]:
        assert link["source"] != target_id
        assert link["target"] != target_id

    # Verify ledger no longer references the deleted belief id
    ledger = session.get(f"{API}/ledger", timeout=30).json()
    for rv in ledger:
        assert rv["belief_id"] != target_id, "Revision row should be cascade-deleted"


# --- Verify contradicts / supports kinds emitted on edges ---
def test_edge_kinds_valid(session):
    graph = session.get(f"{API}/graph", timeout=30).json()
    for link in graph["links"]:
        assert link["kind"] in {"depends_on", "contradicts", "supports"}


# --- Persistence: POST then GET on a fresh entry ---
def test_create_persists_in_postgres(session):
    session.delete(f"{API}/reset", timeout=30)
    text = "I think long-form writing makes you a clearer thinker — the act of structuring sentences forces you to find the actual argument."
    r = session.post(f"{API}/entries", json={"text": text}, timeout=120)
    assert r.status_code == 200, r.text
    assert r.json()["count"] >= 1
    bid = r.json()["results"][0]["belief"]["id"]
    # GET via list
    beliefs = session.get(f"{API}/beliefs", timeout=30).json()
    assert any(b["id"] == bid for b in beliefs)
    # GET via detail
    detail = session.get(f"{API}/beliefs/{bid}", timeout=30).json()
    assert detail["belief"]["id"] == bid
    assert detail["belief"]["statement"]


# --- seed-demo uses separate AsyncSessionLocal per entry ---
def test_seed_demo_multi_session(session):
    r = session.post(f"{API}/seed-demo", timeout=240)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["entries"] == 4
    assert data["seeded_beliefs"] >= 1
    # Beliefs persisted across sessions
    beliefs = session.get(f"{API}/beliefs", timeout=30).json()
    assert len(beliefs) >= 1
    # graph still consistent
    g = session.get(f"{API}/graph", timeout=30).json()
    assert len(g["nodes"]) == len(beliefs)

"""End-to-end backend tests for Belief Ledger API."""
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
    return s


@pytest.fixture(scope="module", autouse=True)
def reset_db(session):
    r = session.delete(f"{API}/reset", timeout=30)
    assert r.status_code == 200
    yield
    # final cleanup
    session.delete(f"{API}/reset", timeout=30)


@pytest.fixture(scope="module")
def first_entry(session):
    payload = {"text": "I believe remote work boosts engineering productivity because async communication reduces interruptions and people get longer focus blocks. Open offices destroy deep work."}
    r = session.post(f"{API}/entries", json=payload, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    return data


def test_root(session):
    r = session.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_entry_too_short(session):
    r = session.post(f"{API}/entries", json={"text": "no"}, timeout=15)
    assert r.status_code == 400


def test_create_first_entry(first_entry):
    res = first_entry["results"][0]
    assert "_id" not in res["belief"]
    b = res["belief"]
    assert b["id"] and b["statement"] and 0 <= b["confidence"] <= 100
    assert isinstance(b["evidence"], list)
    assert isinstance(b["assumptions"], list)
    assert b["short_id"].startswith("blf_")
    assert res["action"] == "created"


def test_list_beliefs_has_centrality(session, first_entry):
    r = session.get(f"{API}/beliefs", timeout=30)
    assert r.status_code == 200
    beliefs = r.json()
    assert len(beliefs) >= 1
    for b in beliefs:
        assert "_id" not in b
        assert "centrality" in b


def test_belief_detail(session, first_entry):
    bid = first_entry["results"][0]["belief"]["id"]
    r = session.get(f"{API}/beliefs/{bid}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for k in ("belief", "upstream", "downstream", "contradictions", "supports", "revisions"):
        assert k in data
    assert "_id" not in data["belief"]
    assert len(data["revisions"]) >= 1
    assert data["revisions"][0]["kind"] in {"created", "confidence_shift", "evidence_added", "dependency_added", "contradiction"}


def test_belief_not_found(session):
    r = session.get(f"{API}/beliefs/does-not-exist", timeout=15)
    assert r.status_code == 404


def test_ledger(session, first_entry):
    r = session.get(f"{API}/ledger", timeout=30)
    assert r.status_code == 200
    revs = r.json()
    assert len(revs) >= 1
    assert any(rv["kind"] == "created" for rv in revs)
    for rv in revs:
        assert "_id" not in rv
        assert "statement" in rv


def test_graph(session, first_entry):
    r = session.get(f"{API}/graph", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "nodes" in data and "links" in data
    assert len(data["nodes"]) >= 1
    for n in data["nodes"]:
        assert "_id" not in n
        for k in ("id", "short_id", "label", "confidence", "topic", "centrality"):
            assert k in n
    for l in data["links"]:
        assert l["kind"] in {"depends_on", "contradicts", "supports"}


def test_contradiction_entry(session, first_entry):
    # Submit a contradictory entry
    payload = {"text": "Remote work is harming engineering productivity. Without in-person collaboration teams lose context and ship slower; offices are essential for serious work."}
    r = session.post(f"{API}/entries", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    # Check ledger for contradiction kind (LLM is non-deterministic, so we check for the relationship presence)
    time.sleep(1)
    lr = session.get(f"{API}/ledger", timeout=30).json()
    # accept either explicit contradiction kind or that a new belief was created
    has_contradiction = any(rv["kind"] == "contradiction" for rv in lr)
    has_two_beliefs = len(session.get(f"{API}/beliefs", timeout=30).json()) >= 2
    assert has_contradiction or has_two_beliefs, "Expected either contradiction revision or 2 beliefs"


def test_crux(session, first_entry):
    bid = first_entry["results"][0]["belief"]["id"]
    r = session.post(f"{API}/beliefs/{bid}/crux", timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["belief_id"] == bid
    assert isinstance(data["cruxes"], list)
    assert 1 <= len(data["cruxes"]) <= 3
    for c in data["cruxes"]:
        assert "assumption" in c and "falsifier" in c
        assert 1 <= c["importance"] <= 10


def test_scan(session, first_entry):
    article = ("A new survey shows remote engineering teams ship 25% more features per quarter than in-office teams. "
               "However, critics argue collaboration suffers, and onboarding new engineers in fully remote teams is significantly harder than co-located teams.")
    r = session.post(f"{API}/scan", json={"text": article}, timeout=90)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "claims" in data
    if data["claims"]:
        prev = 10**9
        for c in data["claims"]:
            assert c["relation"] in {"conflict", "support"}
            assert "quote" in c and "belief_id" in c and "severity" in c and "score" in c
            assert "belief" in c
            assert c["score"] <= prev
            prev = c["score"]


def test_scan_too_short(session):
    r = session.post(f"{API}/scan", json={"text": "too short"}, timeout=15)
    assert r.status_code == 400


def test_delete_belief(session):
    beliefs = session.get(f"{API}/beliefs", timeout=30).json()
    assert beliefs
    target = beliefs[0]["id"]
    r = session.delete(f"{API}/beliefs/{target}", timeout=30)
    assert r.status_code == 200
    assert r.json().get("deleted") == 1
    r2 = session.get(f"{API}/beliefs/{target}", timeout=15)
    assert r2.status_code == 404


def test_reset(session):
    r = session.delete(f"{API}/reset", timeout=30)
    assert r.status_code == 200
    assert r.json().get("reset") is True
    beliefs = session.get(f"{API}/beliefs", timeout=15).json()
    assert beliefs == []

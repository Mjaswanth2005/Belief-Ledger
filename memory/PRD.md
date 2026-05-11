# Belief Ledger — PRD

## Original Problem Statement
A personal epistemic tool that tracks what you believe, why, and how it changes — like a financial ledger for convictions. Beliefs have confidence (0–100%), evidence, and dependencies. New entries surface contradictions, confidence shifts, and downstream effects. Three views (Ledger / Graph / Crux) + Conflict Scanner that highlights only the claims in an article that intersect your stored beliefs, ranked by belief centrality.

## Stack
- Backend: FastAPI + MongoDB (Motor)
- LLM: Nebius Token Factory (OpenAI-compatible), model `meta-llama/Llama-3.3-70B-Instruct`
- Frontend: React + Tailwind + shadcn/ui + Sonner; `react-force-graph-2d` for graph
- Auth: none (single-user)

## User Persona
A single power-user (writer / researcher / engineer / founder) who wants explicit, queryable epistemic state.

## Core Requirements (static)
- Extract beliefs (statement, confidence, topic, evidence, assumptions) from natural text
- Detect contradictions, duplicates, dependencies, supports between beliefs
- Record an immutable revision log (git-log style)
- Visualize belief graph (force-directed)
- Compute cruxes (top 2-3 upstream assumptions + falsifiers) per belief
- Scan external article → ranked conflicts/aligned claims

## Implemented (2026-02)
- POST /api/entries, /api/scan
- GET /api/beliefs, /api/beliefs/{id}, /api/ledger, /api/graph
- POST /api/beliefs/{id}/crux; DELETE /api/beliefs/{id}, /api/reset
- LLM service with extract / classify / crux / scan prompts + robust JSON parser
- Terminal/IDE frontend (JetBrains Mono, void black, amber accents, scanlines)
- Composer + 3 tabs (Ledger / Graph / Scanner) + BeliefDetail modal with crux compute

## Backlog
- P1: stylized confirm dialog (replace native window.confirm for reset)
- P1: export ledger as JSON / Markdown
- P2: undo last revision
- P2: tag filter & topic clustering on graph
- P2: scheduled "review your top-N most central beliefs" prompt
- P2: keyboard nav between revisions
- P2: pagination when revisions > 500

## Iteration 2 (2026-02 same session)
Addressing 6 UX gaps user identified:
- POST /api/seed-demo (instant value seed; uses LLM with json-mode + retry)
- GET /api/cruxes?limit=N (top-N ranked by centrality × revision-volatility)
- GET /api/beliefs/{id}/ripple (multi-hop downstream BFS)
- 4-tab navigation: LEDGER | GRAPH | CRUX | SCANNER
- ExtractionResult inline panel after each commit (contradictions surfaced FIRST with side-by-side confidence bars + ripple panel)
- "what would change my mind?" inline button per extracted belief
- Empty-state [load demo ledger] buttons on Ledger/Graph
- BeliefDetail contradictions render side-by-side confidence comparison
- llm_service hardened: response_format=json_object + retry on empty extraction

## Iteration 3 (Supabase + Groq migration)
- Migrated storage: MongoDB → Supabase Postgres (transaction pooler, port 6543)
- Backend: async SQLAlchemy + asyncpg + Alembic. Tables: entries, beliefs, dependencies, revisions (JSONB for evidence/assumptions/cruxes; FK ondelete=CASCADE)
- Initial migration applied: `alembic upgrade head`
- Swapped LLM provider: Nebius → Groq (`llama-3.3-70b-versatile`, OpenAI-compatible). Generic env names `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` to keep provider-agnostic.
- Verified: 21/21 pytest, all endpoints working; seed-demo now reliably produces 7 beliefs with contradicts+supports edges (faster + more reliable due to Groq + response_format=json_object)

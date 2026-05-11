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

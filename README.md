# Belief Ledger

Belief Ledger is a personal epistemic tool that tracks what you believe, why you believe it, and how those beliefs evolve over time.

## What it does

- Extracts beliefs from free-form text
- Stores confidence, evidence, assumptions, and revision history
- Detects relationships between beliefs (duplicate, contradiction, support, dependency)
- Visualizes the belief graph
- Computes “cruxes” (what would most change your mind)
- Scans external text for conflicts/support against your existing beliefs

## Tech stack

- **Backend:** FastAPI, SQLAlchemy (async), Alembic, PostgreSQL (Supabase-compatible)
- **Frontend:** React (CRACO), Tailwind, shadcn/ui, react-force-graph-2d
- **LLM integration:** OpenAI-compatible client via environment-configured provider

## Repository structure

- `/backend` — API server, DB models, migrations, tests
- `/frontend` — React UI
- `/memory` — product/context docs
- `/tests`, `/test_reports` — supporting test artifacts

## Environment variables

### Backend (`/backend/.env`)

- `DATABASE_URL` (required)
- `LLM_BASE_URL` (required)
- `LLM_API_KEY` (required)
- `LLM_MODEL` (optional, default in code)
- `CORS_ORIGINS` (optional, comma-separated)

### Frontend (`/frontend/.env`)

- `REACT_APP_BACKEND_URL` (required, e.g. `http://localhost:8000`)

## Run locally

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm start
```

Frontend default URL: `http://localhost:3000`

## API overview

Base path: `/api`

- `POST /entries` — ingest text and extract beliefs
- `GET /entries` — list raw journal entries
- `GET /beliefs` — list beliefs
- `GET /beliefs/{belief_id}` — belief detail + relations + revisions
- `DELETE /beliefs/{belief_id}` — delete belief
- `POST /beliefs/{belief_id}/crux` — compute cruxes for one belief
- `GET /beliefs/{belief_id}/ripple` — downstream ripple effects
- `GET /ledger` — revision stream
- `GET /graph` — graph nodes/links
- `POST /scan` — scan text for conflicts/support
- `GET /cruxes` — top-ranked crux beliefs
- `POST /seed-demo` — wipe and seed demo entries
- `DELETE /reset` — wipe all data

## Running tests

### Backend

```bash
cd backend
pytest
```

### Frontend

```bash
cd frontend
CI=true npm test -- --watchAll=false
```

## Notes

- The frontend currently has strict peer resolution between `react-day-picker` and `date-fns`; if install fails in your environment, use your package manager’s peer-dependency compatibility option.
- Some backend dependency pins may rely on private or environment-specific package sources.

# Jamot

Jamot is the backend (and cockpit frontend) for a human-centered, AI-native platform where a **Person or Organization can discover, manage, execute, learn from, and monetize problem-solving capabilities**.

It is a **universal organizational kernel** — not an agent runtime, CRM, ERP, or messaging app. External systems (Letta, Honcho, Graphiti, Hermes, OpenClaw, OpenManus, Matrix, MCP, …) are replaceable implementations behind Jamot interfaces.

> **Jamot owns identity, relationships, permissions, organizational state, capability contracts and governance. External systems provide specialized cognition, communication, execution and knowledge infrastructure.**

> **Source of truth:** [`JAMOT_SPEC.md`](./JAMOT_SPEC.md) is the authoritative product/spec document for this repository. Design decisions and implementations must stay consistent with it.

## Monorepo layout

```
J-01/
├── apps/web/            Next.js 16 cockpit UI (CopilotKit v2, three-pane shell)
├── packages/contracts/  Shared Zod domain contracts (the single source of truth for types)
├── packages/core/       Domain layer: Drizzle schema, events, policy engine, repositories,
│                        memory/knowledge, LLM + routing, apps/resolver, channels,
│                        scheduler, reputation, treasury, harness, MCP
├── packages/api/        Fastify REST API + session auth + Google OAuth + RBAC
├── packages/workers/    Background processes: scheduler/heartbeats, channel adapters
│                        (WhatsApp via Baileys, Matrix via matrix-js-sdk)
└── packages/sdk/        App SDK manifest types
```

## Tech stack

- **Backend**: Node 22, TypeScript (ESM), Fastify, Drizzle + PostgreSQL 16, Redis/BullMQ, Zod
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind v4, CopilotKit v2 (AG-UI + A2UI)
- **Package manager**: pnpm workspaces

## Prerequisites

- Node.js ≥ 22, pnpm ≥ 9 (`corepack enable`)
- Docker (for local Postgres + Redis + Synapse)

## Setup

```bash
corepack enable
pnpm install

# local infrastructure (Postgres on :5433, Redis on :6379, Synapse on :8008)
docker compose up -d postgres redis

cp .env.example .env   # fill in SESSION_SECRET, LLM keys, Google OAuth, etc.

# apply migrations (manual psql; see packages/core/src/migrations/)
cat packages/core/src/migrations/0001_init.sql \
    packages/core/src/migrations/0002_memory_knowledge.sql \
    packages/core/src/migrations/0003_reputation_treasury.sql \
    packages/core/src/migrations/0004_users.sql \
  | docker exec -i jamot-postgres psql -U jamot -d jamot -v ON_ERROR_STOP=1 -f -
```

## Run

```bash
# API (http://localhost:4000) — uses Postgres when DATABASE_URL is set, else in-memory
pnpm --filter @jamot/api dev

# Web (http://localhost:3000) — set NEXT_PUBLIC_API_URL to point at the API
NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm --filter @jamot/web dev

# Scheduler / heartbeat worker
pnpm --filter @jamot/workers dev:scheduler

# Channel worker (WhatsApp QR / Matrix bot) — requires credentials
pnpm --filter @jamot/workers dev:channel
```

WhatsApp pairing: the channel worker runs a small control server that the API proxies
for the `/whatsapp` UI. Point the API at it via `WA_WORKER_URL` (defaults unset → 503).

```bash
# API .env
WA_WORKER_URL=http://localhost:3001
```

If a session is logged out or corrupted, use the **Reset pairing** button in the
WhatsApp app (calls `POST /api/wa/reset`, which wipes the session dir and starts a
fresh QR).

### Pairing WhatsApp on cloud hosts (Render)

WhatsApp refuses the *new-pairing* handshake from datacenter IPs (Render Oregon),
so no QR can be generated there — the connection loops with `status=428` and no
QR ever appears. Existing sessions resume fine from the same IPs.

To pair a fresh session, run the helper from a machine on a residential/office
network, then import the produced folder into the deployed worker:

```bash
pnpm --filter @jamot/workers exec tsx src/wa-pair.ts --out .wa-pair
```

Scan the printed/saved `wa-qr.png` with WhatsApp → Settings → Linked devices.
Once paired, upload the `.wa-pair` directory via the web app
(WhatsApp → **Import**), or post it directly:

```bash
# files: { "creds.json": "<base64>", ... }
curl -X POST https://<api>/api/wa/accounts/<id>/session \
  -H "Content-Type: application/json" -H "Cookie: <session>" \
  -d '{"files":{...}}'
```

The deployed worker then resumes the session from Render's IP.

## Scripts

```bash
pnpm -r typecheck   # typecheck all packages
pnpm -r test        # run all tests (vitest)
pnpm -r build       # build all packages
```

## API surface

`/api/health`, `/actors`, `/people`, `/organizations`, `/spaces`, `/roles`, `/tasks`, `/auth` (login/logout/me + `/auth/google` OAuth), `/agents` (+ `/agents/import-mcp`), `/skills`, `/connectors`, `/capabilities`, `/vault`, `/channels`, `/apps` (+ `/apps/resolve`), `/memory`, `/knowledge`, `/reputation`, `/treasury`, `/routing/intent`, `/tasks/:id/assign`.

## Vibe DREAM Configurator (org graph)

The Organization Visual is the **Vibe DREAM Configurator**: a living system of
`DREAM → TEAMS → HUMANS + AGENTS → RESPONSIBILITIES → TOOLS → HEARTBEATS`
represented as typed graph nodes and edges, persisted in `org_nodes` /
`org_edges` (migration `0021_dream_graph.sql`, schema `orgNodes`/`orgEdges` in
`packages/core/src/schema/index.ts`, contracts in
`packages/contracts/src/dream.ts`). Every mutation is written to organization
memory (events like `node.created`, `edge.created`, `dream.configured`,
`heartbeat.fired`), which the Graphiti dual-write projection mirrors.

DREAM graph endpoints (RBAC: reads = org access, writes = org admin for DREAM
config / deletes, org access for node/edge mutations):

- `GET /organizations/:id/graph` — full graph (auto-creates the org's DREAM node on first read)
- `POST|PATCH|DELETE /organizations/:id/graph/nodes[/:nodeId]`
- `POST|DELETE /organizations/:id/graph/edges[/:edgeId]`
- `PUT /organizations/:id/dream` — structured DREAM config (objective, outcomes, KPIs, constraints, timeline, capabilities, responsibilities)
- `GET /organizations/:id/readiness` — computed DREAM Readiness (never hard-coded)
- `GET /organizations/:id/jamot` — `{ jamot, overall }` (JAMOT = Just A Matter Of Time, operational readiness)

DREAM Readiness is computed by `packages/core/src/dream/readiness.ts` across
10 dimensions (dream objective, responsibility coverage, actors, teams, tools,
permissions, dependencies, heartbeats, recovery, escalation). JAMOT means the
organization is configured to continuously pursue the DREAM, detect problems,
adapt and recover. The underlying **DREAM orchestration skill is platform-owned**
(`packages/core/src/dream/skill.ts`) and not user-editable.

Org-graph **Heartbeats** are executed by the scheduler worker
(`packages/core/src/dream/heartbeat.ts`, wired in `packages/workers`): each due
heartbeat runs Monitor → Evaluate → Act → Verify and records
`heartbeat.fired` / `heartbeat.detected` organizational memory events (used by
the resilience/recruitment flow via the existing outreach + policy-engine
infrastructure).

## Environment variables

See `.env.example`. Key vars: `DATABASE_URL`, `SESSION_SECRET`, `SECRET_ENCRYPTION_KEY`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` (LLM), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`/`FRONTEND_URL` (OAuth), `WHATSAPP_SESSION_DIR`/`MATRIX_*` (channels).

## Temporal knowledge graph (Graphiti + FalkorDB)

Jamot keeps Postgres `memories`/`knowledge` tables as the source of truth. When
enabled, a self-hosted [Graphiti](https://github.com/getzep/graphiti) MCP server
runs as a **dual-write projection**: every `POST /api/memory` is also sent to
Graphiti (episode `source="json"`, `group_id = "<scope>:<ownerId>"`, episode
uuid = memory id), where LLM extraction builds a temporally-aware entity/edge
graph on top of FalkorDB. Reads always come from Postgres; Graphiti mirror
failures are logged and never break the request.

Start it locally:

```bash
docker compose up -d falkordb graphiti-mcp   # http://localhost:8000/mcp/ + /health
```

Enable with:

```
GRAPHITI_ENABLED=true
GRAPHITI_MCP_URL=http://localhost:8000/mcp/
OPENAI_API_KEY=...      # used by Graphiti for extraction + embeddings
SEMAPHORE_LIMIT=2       # LLM concurrency; each store() triggers multiple LLM calls
```

Notes: Graphiti is not provisioned on Render's free tier (needs a host the API
can reach over HTTP + an LLM key). Telemetry is off by default
(`GRAPHITI_TELEMETRY_ENABLED=false`). The `/agents/import-mcp` SSRF guard is
intentionally NOT applied to `GRAPHITI_MCP_URL` — it is an internal,
operator-controlled endpoint, never user input.

## Status

Backend phases P1–P9 and frontend F1–F8 are implemented against the MVP boundary (Personal/Organization spaces, People, Agents, Main Manager routing, WhatsApp/Matrix/MCP, Skills, Connectors, Tasks, Memory, CopilotKit, App SDK, one external-agent import, reputation, treasury, scheduler/heartbeats). Channel + LLM connections require live credentials.

## Deployment (Render)

Live:

- API — https://jamot-api.onrender.com
- Web — https://jamot-web.onrender.com
- Postgres — `jamot-ts-db` (oregon, basic_256mb)
- Scheduler worker — `jamot-scheduler`

Migrations run automatically on deploy via `preDeployCommand` (`pnpm --filter @jamot/core exec tsx scripts/migrate.ts`), tracked in a `schema_migrations` table.

### Google OAuth

1. Create an OAuth 2.0 **web application** client in Google Cloud Console.
2. Add authorized redirect URI: `https://jamot-api.onrender.com/api/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the `jamot-api` service (Dashboard → jamot-api → Environment).

`GOOGLE_REDIRECT_URI` and `FRONTEND_URL` are already set on the service.

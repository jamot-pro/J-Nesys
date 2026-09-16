# Google Maps Worker

Isolated worker that discovers and extracts businesses from Google Maps and
writes them into Jamot's merchant database. It is a separate deployable from
Jamot Core: Core creates jobs and reads results/coverage over HTTP; it never
imports this service's code, and this service never imports Core's.

**Status: architecture + interface stubs.** The pipeline (job queue → search →
parse → normalize → dedup → PostgreSQL) is wired end-to-end and typechecks,
but the actual scraper is not vendored yet (see below), geo-cell auto-creation
is a stub, and the admin UI / metrics exporter are minimal. See inline `STUB:`
comments for what's left.

## Architecture

```
Jamot Core --(HTTP: POST /jobs)--> maps_jobs table (queue) --> JobManager
                                                                    |
                                                     MapsProvider.search()
                                                                    |
                                                        parser -> normalizer -> deduplicator
                                                                    |
                                                          PostgreSQL (maps_companies / maps_locations)
```

- `src/provider/MapsProvider.ts` — the abstraction the rest of the worker
  depends on. Swapping scrapers means writing a new file under
  `src/provider/<name>/` and changing `MAPS_PROVIDER`; nothing else changes.
- `src/provider/omkarcloud/` — wraps the vendored
  [omkarcloud/google-maps-scraper](https://github.com/omkarcloud/google-maps-scraper)
  (MIT) as a subprocess. **Not vendored yet** — see
  `src/provider/omkarcloud/VENDORED_COMMIT.md` for the pinned-commit process
  to follow before this provider actually works.
- `src/jobs/` — job queue (`maps_jobs` table, `FOR UPDATE SKIP LOCKED` claims)
  and the manager that runs claimed jobs through the pipeline.
- `src/normalize/`, `src/dedup/` — phone/domain normalization and the
  deterministic dedup priority: Google Place ID → phone → domain → name +
  geographic proximity (uncertain matches are kept as `possible_duplicate`,
  never silently merged).
- `src/db/` — `schema.sql` (this worker owns these tables) and the writer
  that's the only thing allowed to touch them.
- `src/geo/coverage.ts` — geo-cell coverage state; `subdivide()` splits a cell
  that hit the provider's per-query result cap.
- `src/api/server.ts` — the internal HTTP surface Jamot Core talks to.

## Running locally

```bash
cp .env.example .env   # fill in DATABASE_URL at minimum
psql "$DATABASE_URL" -f src/db/schema.sql
pnpm --filter @jamot/google-maps-worker dev
```

`GET /health` works without vendoring the scraper (it just reports the
subprocess call failed). Everything else needs `vendor/google-maps-scraper/`
in place per `VENDORED_COMMIT.md`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MAPS_WORKER_ENABLED` | `true` | Set `false` to no-op the process (e.g. maintenance) |
| `MAPS_WORKER_CONCURRENCY` | `2` | Max jobs this process runs at once |
| `MAPS_JOB_TIMEOUT` | `1800` (seconds) | Per-job wall-clock timeout |
| `MAPS_RETRY_COUNT` | `3` | Retries for a failed provider search |
| `MAPS_RETRY_BACKOFF_MS` | `2000` | Base backoff, doubled per retry |
| `MAPS_PROVIDER` | `omkarcloud` | Which `MapsProvider` implementation to load |
| `DATABASE_URL` | — (required) | PostgreSQL connection string |
| `PORT` | `8081` | Internal API port |
| `MAPS_WORKER_INTERNAL_TOKEN` | unset | If set, required as `Authorization: Bearer <token>` on every route but `/health` |
| `MAPS_SCRAPER_VENDOR_DIR` | `./vendor/google-maps-scraper` | Where the vendored Python scraper lives |
| `MAPS_SCRAPER_PYTHON` | `python3` | Python interpreter for the subprocess |

Never put credentials for proxies, the scraper, or this worker's own API
token anywhere a frontend client can read them — this service is
internal-only.

## Testing

```bash
pnpm --filter @jamot/google-maps-worker test
```

Covers normalization and dedup priority so far. Still needed (see spec §20):
job state transitions, coverage subdivision, and the failure-mode tests
(timeout, browser crash, DB unavailable, queue unavailable, worker restart).

## Pilot

Before nationwide discovery, run Italy → Campania → Naples → 10-20 categories
and record queries executed, unique locations, duplicate rate, runtime, and
failure rate before sizing infrastructure for more.

## Consuming this worker from Jamot Core

Registered as a second Google Maps `LeadProvider` alongside the Apify-based
one, under the same `lead-generation` app — see
`packages/core/src/leads/providers/google-maps-worker.ts` and its
registration in `packages/core/src/leads/registry.ts`. It is job-based, so the
provider's `search()` polls `GET /jobs/:id` until the job leaves
queued/running, then reads `GET /jobs/:id/results`. Configure it via
`MAPS_WORKER_URL` and `MAPS_WORKER_INTERNAL_TOKEN` (or per-org secrets under
`leads/google-maps-worker/<orgId>`), matching this worker's own
`MAPS_WORKER_INTERNAL_TOKEN` and `PORT`.

## Definition of done (tracking)

Against the integration spec this worker was scaffolded from: not yet done —
vendoring the scraper itself, geo-cell auto-creation, the admin UI, worker
restart recovery, and the failure-mode/integration test suite.

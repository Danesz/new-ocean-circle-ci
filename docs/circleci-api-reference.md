# CircleCI API Reference for Ocean CI

Reference of all CircleCI API endpoints relevant to this dashboard, what we use today, and what's available for future work.

**Base URLs:**
- v2: `https://circleci.com/api/v2` (proxied via `/api/circleci`)
- v1.1: `https://circleci.com/api/v1.1` (proxied via `/api/circleci-v1`)

**Auth:** `Circle-Token` header with personal API token.
**Pagination:** Token-based. Response includes `next_page_token`; pass as `page-token` query param.
**Slug format:** `<vcs>/<org>/<repo>` — v2 uses `gh`/`bb`, v1.1 uses `github`/`bitbucket`.

---

## Currently Implemented

| Method | Endpoint | Client Method | Used In |
|---|---|---|---|
| `GET /me` | Current user | `getMe()` | Auth validation, Setup |
| `GET /project/{slug}` | Project info | `getProject()` | Setup validation |
| `GET /project/{slug}/pipeline` | List pipelines | `getPipelines()` | Branches, Pipelines, Triggers |
| `GET /pipeline/{id}/workflow` | Pipeline workflows | `getWorkflows()` | Pipeline cards, Triggers |
| `GET /workflow/{id}/job` | Workflow jobs | `getJobs()` | PipelineGraph (job DAG) |
| `GET /project/{slug}/job/{num}` | Job detail | `getJobDetail()` | JobPanel |
| `GET /project/{slug}/{num}/tests` | Test results | `getJobTests()` | JobPanel test summary |
| `GET /project/{slug}/{num}/artifacts` | Job artifacts | `getJobArtifacts()` | JobPanel artifact list |
| v1.1 `GET /project/{slug}/{num}` | Build steps + log URLs | `getBuildSteps()` | JobPanel step list |
| (S3 pre-signed URL) | Step log output | `getStepLog()` | JobPanel log viewer |
| `GET /insights/{slug}/workflows` | Workflow summary metrics | `getWorkflowInsights()` | Insights health cards |
| `GET /insights/{slug}/workflows/{name}` | Individual workflow runs | `getWorkflowRuns()` | Insights duration trend chart |
| `GET /insights/{slug}/workflows/{name}/jobs` | Job metrics within workflow | `getJobInsights()` | Insights job breakdown |
| `GET /insights/{slug}/flaky-tests` | Flaky test detection | `getFlakyTests()` | Insights flaky tests section |
| `GET /insights/{slug}/workflows/{name}/test-metrics` | Test performance | `getTestMetrics()` | Insights test metrics |

---

## High Priority — Next to Implement

### Insights API (Not Yet Implemented)

**`GET /insights/{slug}/workflows/{name}/jobs/{job-name}`** — Individual job runs
- Returns per-run: `started_at`, `stopped_at`, `status`, `duration`, `credits_used`
- Use: Job-level duration sparklines, failure investigation

**`GET /insights/time-series/{slug}/workflows/{name}/jobs`** — Job timeseries
- Params: `branch`, `granularity` (hourly/daily), `start-date`, `end-date`
- Hourly data retained 48h, daily retained 90 days
- Use: Time-series charts, build frequency heatmaps

**`GET /insights/{org-slug}/summary`** — Org-level summary
- Params: `reporting-window`, `project-names` (filter)
- Returns org-wide metrics + per-project breakdowns with trend deltas vs previous window
- Use: Executive dashboard, org health scorecard, cross-project comparison

**`GET /insights/{slug}/branches`** — Branches with insights data
- Returns up to 5,000 branches
- Use: Better branch list than deriving from pipeline data

### Action Endpoints (Make it Interactive)

**`POST /workflow/{id}/rerun`** — Rerun a workflow
- Body: `{ enable_ssh, from_failed, jobs[], sparse_tree }`
- Use: "Rerun" and "Rerun from Failed" buttons. Max 100 reruns per pipeline.

**`POST /workflow/{id}/cancel`** — Cancel a running workflow
- Use: "Cancel" button on running workflows

**`POST /workflow/{id}/approve/{approval-request-id}`** — Approve a hold gate
- The `approval_request_id` comes from the job list endpoint (`GET /workflow/{id}/job`)
- Use: "Approve" button for manual approval gates (on_hold jobs)

**`POST /project/{slug}/job/{num}/cancel`** — Cancel a single job
- Use: "Cancel Job" button on individual running jobs

### Multi-Project Support

**`GET /me/collaborations`** — User's organizations
- Returns: array of `{ id, vcs-type, name, avatar_url, slug }`
- Use: Org selector, multi-org support

**`GET /pipeline`** — Org-wide pipeline list
- Params: `org-slug`, `page-token`, `mine` (boolean)
- Returns pipelines across all projects (max 250 most recently built)
- Use: Org-level "all activity" feed

**`GET /project/{slug}/pipeline/mine`** — My pipelines only
- Use: "My Builds" personal filter

---

## Medium Priority

### Pipeline Config

**`GET /pipeline/{id}/config`** — Compiled + source config YAML
- Use: "View Config" feature for debugging pipeline setup errors

### Trigger Endpoints

**`POST /project/{slug}/pipeline`** — Trigger a pipeline
- Body: `{ branch, tag, parameters }`
- Use: "Trigger Build" button

### Schedules

**`GET /project/{slug}/schedule`** — List scheduled triggers
- Returns all schedules for a project
- Use: Schedule overview, showing when automated builds run

**`POST/PATCH/DELETE /project/{slug}/schedule`** — CRUD schedules

### User Resolution

**`GET /user/{id}`** — Get user by ID
- Returns: `id`, `login`, `name`, `avatar_url`
- Use: Resolve `started_by`, `approved_by`, `canceled_by` UUIDs into display names/avatars

### Webhook Management

**`GET /webhook`** — List webhooks
- Params: `scope-id`, `scope-type` (project)
- Supported events: `workflow-completed`, `job-completed`
- Use: Webhook management UI, real-time push updates instead of polling

---

## Low Priority

### Environment & Config Management

**`GET /project/{slug}/envvar`** — List env vars (names + last 4 chars)
**`GET /project/{slug}/checkout-key`** — List checkout keys
**`GET /context`** — List shared contexts
**`GET /context/{id}/environment-variable`** — Context env vars

### Usage & Billing

**`POST /organizations/{org-id}/usage_export_job`** — Create usage export
**`GET /organizations/{org-id}/usage_export_job/{id}`** — Download usage CSV
- Covers: compute, DLC, storage, network, IP ranges
- 13-month history, max 32-day windows per export
- Rate limit: 10 req/hour/org

### OIDC & Policy

**`GET/PATCH/DELETE /org/{id}/oidc-custom-claims`** — OIDC token management
**`GET /owner/{id}/context/{id}/decision`** — Policy decision audit logs

---

## Technical Notes

- **Rate limiting:** CircleCI may return HTTP 429. Use exponential backoff.
- **Insights freshness:** Metrics refreshed daily; last 24h may not be included. `on_hold` workflows excluded.
- **Insights branch scoping:** Defaults to default branch only. Pass `all-branches=true` for all.
- **Insights time windows:** Runs up to 90 days; trends up to 30 days; timeseries hourly only 48h.
- **v1.1 slug differences:** v1.1 uses `github`/`bitbucket`; v2 uses `gh`/`bb`. Our `v1SlugVariants()` helper handles this.
- **v1.1 availability:** May not work for all Bitbucket Cloud projects. Fallback to CircleCI web UI link.
- **Step log URLs:** Pre-signed S3 URLs from v1.1 API. Must be proxied server-side to avoid CORS (our `/api/step-log` middleware).
- **Test data limit:** Max 250MB of test results per job.
- **Rerun limit:** Max 100 reruns per pipeline.

---

## Architecture Notes

### Proxy Setup (vite.config.ts)

| Route | Target | Purpose |
|---|---|---|
| `/api/circleci/*` | `circleci.com/api/v2/*` | v2 API proxy |
| `/api/circleci-v1/*` | `circleci.com/api/v1.1/*` | v1.1 API proxy |
| `/api/step-log?url=` | (dynamic S3 URL) | Step log CORS proxy (custom middleware) |

### Key Files

- `src/api/circleci.ts` — API client with all endpoint methods
- `src/types/circleci.ts` — TypeScript interfaces for all API responses
- `src/hooks/useCircleCI.ts` — React hooks wrapping API calls with loading/error/polling
- `src/context/AuthContext.tsx` — Token + project slug storage, client instantiation
- `src/pages/Insights.tsx` — Insights page with workflow metrics, duration trends, flaky tests, test metrics

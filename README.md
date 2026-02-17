# Ocean CI

An opinionated, Blue Ocean-style pipeline visualizer for CircleCI. It prioritizes a clean, branch-centric workflow over mirroring every screen in the CircleCI UI -- showing you what matters (branches, pipelines, job logs, insights) without the noise.

## Features

- **Branch overview** -- see every branch with its latest pipeline status at a glance
- **Pipeline graph** -- interactive DAG visualization of jobs and dependencies
- **Job detail panel** -- executor info, step logs, test results, artifacts
- **Timeline chart** -- Gantt-style view of parallel job execution
- **Insights dashboard** -- success rate trends, duration charts, flaky test detection
- **Workflow actions** -- rerun, rerun from failed, cancel workflows; approve hold gates; cancel individual jobs
- **Triggers view** -- API-triggered, scheduled, and tag-based pipelines
- **Auto-refresh** -- running workflows poll every 10 seconds

## Prerequisites

- **Node.js 20+**
- A **CircleCI personal API token** ([create one here](https://app.circleci.com/settings/user/tokens))
- A **project slug** in the format `gh/org/repo` (or `bb/org/repo` for Bitbucket)

## Quick start (development)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, enter your token and project slug.

The Vite dev server proxies all CircleCI API requests, so everything works out of the box including step logs.

## Deployment

There are two ways to deploy Ocean CI, depending on whether you have a server or not.

### Option A: Self-hosted (recommended)

Run with the built-in Node.js server. Zero additional dependencies.

```bash
npm run serve
```

This builds the app and starts a server on port 3000 (override with `PORT` env var). The server handles:

| Route | Purpose |
|---|---|
| `/api/circleci/*` | Proxy to CircleCI API v2 |
| `/api/circleci-v1/*` | Proxy to CircleCI API v1.1 |
| `/api/step-log?url=...` | Proxy for step log S3 URLs (CORS workaround) |
| Everything else | Serves `dist/` with SPA fallback |

All features work, including inline step logs.

**Example with Docker or systemd:**

```bash
# Build once
npm ci && npm run build

# Run (stateless, no config needed)
PORT=8080 node server.js
```

### Option B: Static hosting (GitHub Pages, Netlify, Cloudflare Pages)

For free static hosting, the app calls CircleCI's API directly from the browser. No server needed.

```bash
npm run build:static
```

This sets `VITE_STATIC=true`, which makes the client use `https://circleci.com/api/v2` directly instead of proxy paths. Deploy the `dist/` folder to any static host.

**GitHub Pages (automated):**

1. Push to a GitHub repo
2. Go to **Settings > Pages > Source** and select **GitHub Actions**
3. Push to `main` -- the included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically
4. Your app is live at `https://<user>.github.io/<repo>/`

**Limitations on static hosting:**

- Step log viewing may not work (CircleCI's S3 log URLs don't send CORS headers). The app shows a "View in CircleCI" link as fallback.
- All other features (pipelines, workflows, jobs, tests, artifacts, actions) work fine.

## NPM scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server with API proxy (port 5173) |
| `npm run build` | Production build (proxy mode, for use with `server.js`) |
| `npm run build:static` | Production build (direct API, for static hosting) |
| `npm run serve` | Build + start production server (port 3000) |
| `npm run preview` | Preview production build via Vite |

## Architecture

```
src/
  api/circleci.ts     API client (v2 + v1.1, proxy or direct)
  context/AuthContext  Token + project slug, persisted in localStorage
  hooks/useCircleCI   Data-fetching hooks with caching and auto-refresh
  pages/              Branches, Pipelines, WorkflowDetail, Insights, Triggers, Setup
  components/         PipelineGraph (SVG DAG), JobPanel, TimelineChart, StatusBadge
  types/circleci.ts   Full TypeScript types for CircleCI API responses
server.js             Zero-dep Node.js production server with API proxy
vite.config.ts        Dev proxy + step log plugin
```

## Security notes

- Your CircleCI token is stored in **localStorage** and sent as a `Circle-Token` header. It never leaves your browser (or your server, if self-hosted).
- The token is **not** sent to any third party. In proxy mode, `server.js` forwards it to `circleci.com` only. In static mode, the browser sends it directly to `circleci.com`.
- No analytics, tracking, or external requests beyond the CircleCI API.

## Tech stack

React 18, TypeScript, Tailwind CSS, Vite, React Router 6. Zero runtime dependencies beyond React.

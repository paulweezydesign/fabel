# fabel

V1 Agent-Powered Agency Platform — specialized AI agents collaborate through a
deterministic workflow runner, produce structured artifacts, and pause at human
approval gates. See [`prd/v1-agent-powered-agency-platform.md`](prd/v1-agent-powered-agency-platform.md)
for the full spec.

## Quickstart

```bash
pnpm install
pnpm run dev        # standalone Node API server on http://localhost:3000
```

Run a workflow end-to-end (pauses at the approval gate, then resume via API):

```bash
# 1. Start the Lead → Outreach workflow (returns { workflowId, status: "needs_review", ... })
curl -s -X POST localhost:3000/api/workflows/lead-to-outreach/start \
  -H 'content-type: application/json' \
  -d '{"workflowInput":{"prospect":"Acme Corp"},"projectId":"proj-1"}'

# 2. Review artifacts produced so far
curl -s localhost:3000/api/artifacts/<workflowId>

# 3. Approve the gate to complete the workflow
curl -s -X POST localhost:3000/api/workflows/<workflowId>/approve \
  -H 'content-type: application/json' -d '{"stepId":"outreach"}'
```

Run a single agent directly:

```bash
curl -s -X POST localhost:3000/api/agents/research/run \
  -H 'content-type: application/json' -d '{"prompt":"Acme Corp"}'
```

## Configuration

Environment variables are documented in [`.env.example`](.env.example). Copy it
to `.env` (gitignored) and adjust as needed. `PORT` sets the server port; the
`OPENAI_*` variables are optional/forward-looking since the AI client is stubbed
by default.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm run dev` | Run the API server with hot reload (`PORT`, default 3000) |
| `pnpm test` | Run the Vitest suite |
| `pnpm run test:coverage` | Run the suite with V8 coverage (thresholds enforced) |
| `pnpm run typecheck` | Type-check with `tsc --noEmit` |
| `pnpm run lint` | Lint with ESLint |
| `pnpm run build` | Emit `dist/` |

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and
pull request. It installs dependencies with a frozen lockfile, then runs lint,
typecheck, `test:coverage` (which enforces coverage thresholds in
[`vitest.config.ts`](vitest.config.ts)), and build.

## Design

- **AI provider is stubbed by default** so everything runs without an API key;
  inject a real `AiClient` via `createApp({ aiClient })` (`src/app.ts`).
- **Approvals** are API calls; workflows rest at `needs_review` until approved.
- **Persistence** is in-memory by default (a `FileArtifactStore` exists behind
  the same interface); state resets on restart.

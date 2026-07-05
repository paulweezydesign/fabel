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

## Scripts

| Command | Purpose |
|---|---|
| `pnpm run dev` | Run the API server with hot reload (`PORT`, default 3000) |
| `pnpm test` | Run the Vitest suite |
| `pnpm run typecheck` | Type-check with `tsc --noEmit` |
| `pnpm run lint` | Lint with ESLint |
| `pnpm run build` | Emit `dist/` |

## Design

- **AI provider is stubbed by default** so everything runs without an API key;
  inject a real `AiClient` via `createApp({ aiClient })` (`src/app.ts`).
- **Approvals** are API calls; workflows rest at `needs_review` until approved.
- **Persistence** is in-memory by default (a `FileArtifactStore` exists behind
  the same interface); state resets on restart.

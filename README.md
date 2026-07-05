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

## AI provider

`createApp()` auto-selects the AI backend via `selectAiClient(process.env)`
(`src/services/openai-ai-client.ts`): if `OPENAI_API_KEY` is set it uses the
real `OpenAiClient` (OpenAI-compatible Chat Completions), otherwise it falls
back to the offline `StubAiClient`. Pass `createApp({ aiClient })` to override.

| Env var | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | _(none)_ | Enables the real provider; required by `OpenAiClient` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API base URL (any OpenAI-compatible endpoint) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model id used for completions |

```bash
OPENAI_API_KEY=sk-... pnpm run dev   # uses the real provider
pnpm run dev                         # no key → stub responses
```

## Design

- **AI provider auto-selected** (see above): real when `OPENAI_API_KEY` is set,
  else stubbed so everything runs without an API key.
- **Approvals** are API calls; workflows rest at `needs_review` until approved.
- **Persistence** is in-memory by default (a `FileArtifactStore` exists behind
  the same interface); state resets on restart.

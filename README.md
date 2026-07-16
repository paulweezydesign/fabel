# fabel

[![CI](https://github.com/paulweezydesign/fabel/actions/workflows/ci.yml/badge.svg)](https://github.com/paulweezydesign/fabel/actions/workflows/ci.yml)

V1 Agent-Powered Agency Platform — specialized AI agents collaborating on research, strategy documents, code and client outreach, orchestrated by a lightweight workflow runner with human approval gates.

CI runs on every push and pull request (`npm test`, `npm run typecheck`, `npx next build`). No API keys are required — tests stub the AI client.

The full spec lives in [`prd/v1-agent-powered-agency-platform.md`](prd/v1-agent-powered-agency-platform.md).

## Teaching sandbox (React Router RSC)

Part 1 of the RR RSC + Better Auth + MongoDB series lives in [`examples/rr7-rsc-rag`](examples/rr7-rsc-rag) — experimental React Router RSC Framework Mode, separate from the Next.js V1 app.

```bash
cd examples/rr7-rsc-rag && npm install && npm run dev
```

## Architecture

Four layers (see the PRD for details):

- **Shared agent abstractions** (`src/core/`) — `AgentType`, `AgentContext`, `AgentRunResult` and the abstract `BaseAgent` (task lifecycle, injected AI/logging/messaging).
- **Agent factory** (`src/core/agent-factory.ts`) — maps agent types to constructors, injects shared services. Registry of the seven V1 agents is in `src/agents/registry.ts`.
- **Workflow runner** (`src/core/workflow-runner.ts`) — deterministic sequential execution with dependency handling; pauses in `needs_review` after approval-gated steps so the operator reviews actual output.
- **Artifact store** (`src/core/artifact-store.ts`) — in-memory and file-based implementations behind one contract-tested interface.
- **Workflow run store** (`src/core/workflow-run-store.ts`) — persists serialisable run snapshots so approval can happen in a separate HTTP request.

The seven agents: project manager, research, designer, tech lead, full-stack engineer, QA, client growth. Three V1 workflows in `src/workflows/`: Lead → Outreach, Intake → Project Brief, Brief → Build Plan.

## Workflow API

Run a full multi-agent workflow end-to-end (with approval gates):

```bash
# Start Lead → Outreach
curl -X POST http://localhost:3000/api/workflows/lead-to-outreach/run \
  -H "Content-Type: application/json" \
  -d '{"projectId":"proj-1","input":{"leadName":"Acme Corp"}}'

# Check status and artifacts (use run.id from the response)
curl http://localhost:3000/api/workflows/runs/<runId>

# Optionally edit the gated artifact before approving
curl -X POST http://localhost:3000/api/workflows/runs/<runId>/edit \
  -H "Content-Type: application/json" \
  -d '{"stepId":"draft-outreach","edits":{"message":"Hi Acme — revised opener."}}'

# Approve the paused step (optional edits applied first)
curl -X POST http://localhost:3000/api/workflows/runs/<runId>/approve \
  -H "Content-Type: application/json" \
  -d '{"stepId":"draft-outreach","edits":{"subject":"Quick idea for Acme"}}'

# Or reject it (optional reason)
curl -X POST http://localhost:3000/api/workflows/runs/<runId>/reject \
  -H "Content-Type: application/json" \
  -d '{"stepId":"draft-outreach","reason":"Tone does not match the agency voice"}'
```

## Operator dashboard

Open `http://localhost:3000` after starting the dev server. Pick a workflow, enter client details, and click **Run workflow** — the UI returns immediately and polls for live step progress while agents work in the background. At the approval gate you can **edit** the gated output, **Save edits**, then **Approve**, or **Reject** with an optional reason.

The dashboard calls the workflow API routes below the hood — no curl required.

Workflow ids: `lead-to-outreach`, `intake-to-project-brief`, `brief-to-build-plan`.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your NVIDIA NIM API key
```

The AI provider is NVIDIA NIM (OpenAI-compatible), default model `nvidia/nemotron-3-ultra-550b-a55b`. Keys are server-side only; the browser talks to agents through `POST /api/agents/<type>/run`.

Workflow runs and artifacts default to **SQLite** at `.data/fabel.db` (gitignored), so past runs survive `npm run dev` restarts in one durable database. Set `FABEL_PERSISTENCE=file` for the legacy JSON directories, or `memory` for ephemeral sessions.

### Single-tenant auth

Set `FABEL_AUTH_PASSWORD` to require a login before the dashboard or APIs can be used (PRD §10 — hardcoded single tenant for the prototype). Optionally set `FABEL_AUTH_SECRET` for cookie signing (defaults to the password). When the password is unset, auth stays off so local/CI flows remain open.

```bash
# .env.local
FABEL_AUTH_PASSWORD=your-shared-password
FABEL_AUTH_SECRET=a-long-random-string
```

Then open `http://localhost:3000` — you’ll be redirected to `/login`. Sign out from the dashboard header.

## Development

```bash
npm test             # full Vitest suite (no network — AI is stubbed)
npm run test:coverage  # same suite with coverage thresholds
npm run typecheck
npm run dev          # Next.js dev server
npm run build && npm start
```

Try an agent:

```bash
curl -X POST http://localhost:3000/api/agents/research/run \
  -H "Content-Type: application/json" \
  -d '{"input":{"workflowInput":{"leadName":"Acme Corp","goal":"New website"}}}'
```

## Conventions

- Test-driven development: write the failing test first, then the minimum code to pass. Untested code does not count.
- Adding an agent: extend `StructuredAgent` (or `BaseAgent`), register it in `src/agents/registry.ts`. Nothing else changes.
- Adding a workflow: define a `WorkflowDefinition` in `src/workflows/` — no core runner changes.

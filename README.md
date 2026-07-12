# fabel

[![CI](https://github.com/paulweezydesign/fabel/actions/workflows/ci.yml/badge.svg)](https://github.com/paulweezydesign/fabel/actions/workflows/ci.yml)

V1 Agent-Powered Agency Platform — specialized AI agents collaborating on research, strategy documents, code and client outreach, orchestrated by a lightweight workflow runner with human approval gates.

CI runs on every push and pull request (`npm test`, `npm run typecheck`, `npx next build`). No API keys are required — tests stub the AI client.

The full spec lives in [`prd/v1-agent-powered-agency-platform.md`](prd/v1-agent-powered-agency-platform.md).

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

# Approve the paused step (use pendingApprovalStepId from the response)
curl -X POST http://localhost:3000/api/workflows/runs/<runId>/approve \
  -H "Content-Type: application/json" \
  -d '{"stepId":"draft-outreach"}'
```

## Operator dashboard

Open `http://localhost:3000` after starting the dev server. Pick a workflow, enter client details, and click **Run workflow** — the UI returns immediately and polls for live step progress while agents work in the background. Review artifacts at the approval gate, then click **Approve & continue**.

The dashboard calls the workflow API routes below the hood — no curl required.

Workflow ids: `lead-to-outreach`, `intake-to-project-brief`, `brief-to-build-plan`.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in your NVIDIA NIM API key
```

The AI provider is NVIDIA NIM (OpenAI-compatible), default model `nvidia/nemotron-3-ultra-550b-a55b`. Keys are server-side only; the browser talks to agents through `POST /api/agents/<type>/run`.

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

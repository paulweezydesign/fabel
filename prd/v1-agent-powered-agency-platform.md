# PRD: V1 Agent-Powered Agency Platform

**Status:** Draft
**Project:** fabel
**Version:** 1.0
**Last updated:** 2026-07-04

---

## 1. Problem Statement

Design/development agencies spend significant manual effort on repeatable knowledge work: researching prospects and clients, drafting outreach, composing project briefs, planning technical builds, and QA-ing deliverables. Each of these tasks is well-suited to a specialized AI agent, but ad-hoc scripts and one-off prompts don't compose: outputs are unstructured, handoffs between steps are manual, and there is no human oversight built into the process.

V1 of the platform solves this by providing a **cohesive multi-agent architecture** in which specialized agents collaborate through a deterministic workflow runner, produce structured artifacts, and pause for human approval at defined gates. The emphasis is on a **simple orchestration model** — ordered steps with dependency handling — rather than complex distributed coordination, so the system can be built quickly and extended iteratively.

## 2. Goals

### Product goals

- Demonstrate end-to-end agent collaboration on three real agency workflows: lead outreach, project intake, and build planning.
- Every agent output is a **structured object** (not plain text) that can be stored, reviewed, and consumed by downstream steps.
- Human oversight is a first-class concept: workflows pause at approval gates and resume only after explicit sign-off.
- API keys never reach the browser; all agent execution happens server-side behind HTTP endpoints.

### Engineering goals

- A single `BaseAgent` abstraction so new agents require only a system prompt and an `executeTask()` implementation — no boilerplate duplication.
- Centralized instantiation via `AgentFactory` so shared services (AI client, message bus, artifact store, logger) are injected uniformly.
- New workflows can be defined as data (ordered `WorkflowStep[]`) without modifying core runner code.
- V1 persistence is deliberately simple (in-memory or file-based artifact store) with a clean interface that permits a later database migration without touching agents or the runner.

### Non-goals (V1)

- Parallel task execution or conditional workflow branching.
- Database-backed persistence.
- Distributed message queues.
- Multi-tenant authentication/authorization enforcement (context carries tenant IDs, but access control is out of scope).

## 3. Users and User Stories

**Primary user:** an agency operator (founder, PM, or account lead) who initiates workflows and reviews/approves agent output.

| # | User story | Priority |
|---|-----------|----------|
| US-1 | As an agency operator, I can run a **Lead → Outreach** workflow so that a prospect is researched and a personalized outreach plan is drafted for my approval. | P0 |
| US-2 | As an agency operator, I can run an **Intake → Project Brief** workflow so that client goals and market context are synthesized into a brief I approve before sharing. | P0 |
| US-3 | As an agency operator, I can run a **Brief → Build Plan** workflow so that design direction, technical architecture, and a QA checklist are produced with a final approval step before implementation begins. | P0 |
| US-4 | As an agency operator, I can review every artifact an agent produced for a workflow, so nothing an agent generated is invisible to me. | P0 |
| US-5 | As an agency operator, when a workflow reaches an approval gate it pauses and clearly signals `needs_review`, so no client-facing output ships without human sign-off. | P0 |
| US-6 | As a developer, I can add a new agent by extending `BaseAgent` and registering it in the factory, without changing the workflow runner or other agents. | P1 |
| US-7 | As a developer, I can define a new workflow as an ordered list of steps with dependencies and approval flags, without writing new orchestration code. | P1 |
| US-8 | As a client-side developer, I can call any agent through a uniform `run()` interface that posts to `/api/agents/:type/run`, without handling network details or credentials. | P1 |

## 4. Architectural Overview

V1 consists of four layers:

1. **Shared agent abstractions** — common types and the abstract `BaseAgent` class providing lifecycle management, logging, messaging hooks, and AI access.
2. **Centralized agent factory** — `AgentFactory` maps `AgentType` to constructors and injects shared services.
3. **Lightweight workflow runner** — `WorkflowRunner` executes ordered steps with dependency handling and approval gates.
4. **Simple artifact store** — persists structured agent outputs for review and for use as inputs to subsequent steps.

```
Client (browser)
  └── Agent Client Factory ── POST /api/agents/:type/run
        Server (API routes)
          └── AgentFactory.createAgent(type)
                └── BaseAgent subclass ── AiClient (server-side keys)
        WorkflowRunner
          ├── picks next ready step (deps complete)
          ├── pauses on approval gates (needs_review)
          └── saves AgentRunResult ── ArtifactStore
```

## 5. Technical Context

The `fabel` repository is **greenfield** (currently only a `README.md`), so V1 establishes the initial project structure and conventions. There are no existing data models, routes, or components to integrate with — the file layout below is the proposed source of truth.

Team conventions that this build must follow (from workspace rules):

- **TypeScript/JavaScript with modern syntax and functional principles.** Prefer pure functions, immutability, and composition; classes are used only where the spec calls for them (`BaseAgent` inheritance hierarchy).
- **Test-driven development is mandatory.** Every module below ships with tests written first (red → green → refactor). Untested code does not count as done.

### Proposed file structure

```
src/
  core/
    agent-types.ts        # AgentType enum — single source of truth for agent names
    agent-context.ts      # AgentContext: tenant, project, lead IDs
    agent-result.ts       # AgentRunResult: status, summary, output, questions, risks
    base-agent.ts         # abstract BaseAgent
    agent-factory.ts      # AgentFactory with createAgent()
    workflow-runner.ts    # WorkflowRunner + WorkflowStep types
    artifact-store.ts     # ArtifactStore interface + in-memory/file implementations
  agents/
    project-manager-agent.ts
    research-agent.ts
    designer-agent.ts
    tech-lead-agent.ts
    full-stack-engineer-agent.ts
    qa-agent.ts
    client-growth-agent.ts
  services/
    ai-client.ts          # injected AI access; server-side only
    message-bus.ts        # messaging hooks between agents
    logger.ts
  api/
    agents/[type]/run.ts  # HTTP endpoint per agent
  client/
    agent-client-factory.ts  # browser-safe run() wrapper over HTTP
  workflows/
    lead-to-outreach.ts
    intake-to-project-brief.ts
    brief-to-build-plan.ts
```

## 6. Functional Requirements

### 6.1 Core definitions

**FR-1 — `agent-types.ts`.** Defines an `AgentType` enum listing exactly the V1 agents: `project_manager`, `research`, `designer`, `tech_lead`, `full_stack_engineer`, `qa`, `client_growth`. All code referencing agent names must use this enum; string literals for agent types elsewhere are a defect.

**FR-2 — `agent-context.ts`.** Defines `AgentContext` specifying the contextual data an agent can access during execution: tenant ID, project ID, and lead ID (each optional depending on workflow). Agents must not reach outside their provided context.

**FR-3 — `agent-result.ts`.** Defines a uniform `AgentRunResult` with fields:

- `status` — success/failure indicator
- `summary` — human-readable description of what was done
- `output` — structured, agent-specific payload
- `questions` — open questions requiring human input (may be empty)
- `risks` — identified risks (may be empty)

The workflow runner must be able to handle any agent's result **without agent-specific logic**.

### 6.2 BaseAgent

**FR-4.** `BaseAgent` is abstract and provides:

- Identity (unique ID, `AgentType`) and stored `AgentContext`.
- Task lifecycle management: `pending → in_progress → completed | failed`. Invalid transitions (e.g., completing a task never started) must throw.
- AI access delegated to an injected `AiClient` — agents never construct clients or hold API keys themselves.
- Logging and messaging hooks via injected services.

**FR-5.** Specialized agents override exactly two methods:

- `getDefaultSystemPrompt()` — returns the system prompt shaping model behaviour.
- `executeTask()` — performs the work and returns structured data conforming to `AgentRunResult`.

### 6.3 AgentFactory

**FR-6.** `AgentFactory` maps each `AgentType` to its constructor and exposes `createAgent(type, context)` which:

1. Generates a unique agent ID.
2. Injects shared services: AI client, message bus, artifact store, logger.
3. Returns an instance of the requested type.

**FR-7.** Requesting an unregistered `AgentType` fails fast with a descriptive error (error state — see §8).

**FR-8.** Adding a new agent requires only: implement the subclass, register it in the factory map. No other core files change.

### 6.4 WorkflowRunner

**FR-9.** A `WorkflowStep` includes: `id`, human-readable `title`, the `AgentType` that executes it, optional `dependsOn` step IDs, and a `requiresApproval` flag.

**FR-10.** The runner executes a workflow as follows:

1. Mark the workflow `running` and record `startedAt`.
2. Pick the next **ready** step — all dependencies completed and the step not yet started. Steps run in deterministic order.
3. If the step's result requires approval (`requiresApproval: true`), set workflow status to `needs_review` and **pause**. The workflow resumes only via an explicit approval action.
4. Otherwise, use the factory to create the appropriate agent and call `assignTask()`.
5. Save the resulting `AgentRunResult` in the artifact store and update the step status.
6. Continue until all steps are completed or a critical failure occurs.

**FR-11.** On step failure, the runner marks the step `failed`, records the error, and halts the workflow (V1: fail-stop; no automatic retries). The partial artifacts produced so far remain reviewable.

### 6.5 ArtifactStore

**FR-12.** Each artifact has: `id`, `workflowId`, `projectId`, producing `agentType`, `title`, and `content` (the structured output).

**FR-13.** V1 ships an in-memory implementation (default) and may add a file-based one behind the same interface. The interface must not leak storage details, so a database implementation can replace it later without changes to agents or the runner.

**FR-14.** Artifacts are retrievable by workflow ID so an operator can review everything a workflow produced (US-4).

### 6.6 Specialized agents

Each agent extends `BaseAgent` and returns structured output — never plain prose blobs.

| Agent | Responsibility |
|---|---|
| **Project Manager** | Clarifies client goals, breaks work into milestones, identifies blockers, assigns tasks. |
| **Research** | Retrieval-augmented research on the client's business or market; returns cited facts. |
| **Designer** | Generates brand and layout direction from business context. |
| **Tech Lead** | Determines technical architecture and file structures. |
| **Full-Stack Engineer** | Implements code tasks according to the technical plan. |
| **QA** | Defines acceptance criteria and tests output to catch issues early. |
| **Client Growth** | Lead research, personalized outreach drafting, prospect nurturing. |

### 6.7 Client-side interface

**FR-15.** The browser never holds AI provider keys. All agent execution goes through server HTTP endpoints of the form `POST /api/agents/:type/run` (e.g., `/api/agents/research/run`).

**FR-16.** An **Agent Client Factory** in client code returns an object exposing `run(input)`, which posts to the appropriate route and awaits the response. The interface is identical across agent types.

### 6.8 V1 workflows

**FR-17 — Lead → Outreach.** Research Agent summarizes a prospect's business → Client Growth Agent drafts a personalized outreach plan → **approval gate** (outreach must reflect the agency's tone before sending).

**FR-18 — Intake → Project Brief.** Project Manager Agent summarizes client goals → Research Agent adds market context → Project Manager composes the brief → **approval gate**.

**FR-19 — Brief → Build Plan.** Designer Agent proposes visual direction → Tech Lead Agent outlines a build plan → QA Agent creates a QA checklist → **final approval gate** before implementation.

All three are strictly sequential with explicit handoffs; parallel and conditional flows are deferred.

## 7. Acceptance Criteria

These map directly to test cases (TDD: write the test, watch it fail, implement).

**Core types & BaseAgent**
- AC-1: `AgentType` contains exactly the seven V1 agents; the factory rejects any value outside the enum.
- AC-2: A `BaseAgent` task transitions `pending → in_progress → completed`; an invalid transition throws.
- AC-3: A failing `executeTask()` results in task status `failed` and an `AgentRunResult` with failure status — the error does not escape unhandled.
- AC-4: `BaseAgent` uses only the injected `AiClient`; a test double captures all AI calls (no network in unit tests).

**Factory**
- AC-5: `createAgent()` returns the correct subclass for each registered `AgentType`, with a unique ID and all four shared services injected.
- AC-6: `createAgent()` with an unregistered type throws a descriptive error.

**WorkflowRunner**
- AC-7: Steps execute in dependency order; a step never runs before all of its `dependsOn` steps are `completed`.
- AC-8: A step with `requiresApproval: true` sets the workflow to `needs_review` and no subsequent step runs until approval is granted.
- AC-9: After approval, the workflow resumes from the paused step's successor, not from the beginning.
- AC-10: On step failure the workflow halts, the step is marked `failed`, and previously stored artifacts remain retrievable.
- AC-11: Every completed step's result is persisted as an artifact with correct `workflowId`, `agentType`, and content.

**ArtifactStore**
- AC-12: Artifacts round-trip (save → retrieve by ID and by workflow ID) with all fields intact.
- AC-13: Swapping the in-memory implementation for the file-based one passes the same interface test suite unchanged.

**Client interface**
- AC-14: The client factory's `run()` posts to `/api/agents/:type/run` for the requested type and returns the parsed result; no AI credentials appear in any client bundle or request payload.
- AC-15: A non-2xx response from the API surfaces as a structured error to the caller, not an unhandled rejection.

**End-to-end workflows**
- AC-16: Each of the three V1 workflows runs to its approval gate with stubbed AI responses, produces the expected artifact sequence, pauses at the gate, and completes after approval.

## 8. Edge Cases and Error States

| Scenario | Required behaviour |
|---|---|
| Unregistered agent type requested | Factory throws immediately with the offending type named; workflow step marked `failed`. |
| Circular or missing step dependencies | Runner detects at workflow start (validation pass) and refuses to run, reporting the offending step IDs. |
| AI client error (timeout, rate limit, provider outage) | `executeTask()` returns a failure `AgentRunResult`; step marked `failed`; workflow halts per FR-11. No silent retries in V1. |
| Malformed agent output (doesn't conform to `AgentRunResult`) | Result validated at the runner boundary; treated as step failure with a validation error recorded. |
| Approval never granted | Workflow remains `needs_review` indefinitely — this is a valid resting state, not an error. Artifacts up to the gate remain reviewable. |
| Empty workflow (zero steps) | Runner completes immediately with status `completed` and zero artifacts (empty state). |
| Artifact store unavailable (file-based: unwritable path) | Step fails with a storage error; the agent's result is included in the error report so work isn't silently lost. |
| Client calls endpoint for unknown agent type | API responds 404 with a structured error body; client factory surfaces it per AC-15. |
| Concurrent run of the same workflow instance | Out of scope for V1; runner rejects a `run()` call on a workflow already `running` or `needs_review`. |

## 9. Testing Strategy

Per team convention, development is test-first throughout:

1. **Unit tests** for every core module (types validation, `BaseAgent` lifecycle, factory registration, runner scheduling, artifact store round-trips) using injected test doubles for `AiClient`, message bus, and logger. No unit test touches the network.
2. **Contract tests** for the `ArtifactStore` interface, run against every implementation (AC-13).
3. **Integration tests** for the three V1 workflows end-to-end with a stubbed `AiClient` returning canned structured outputs (AC-16).
4. **API tests** for `/api/agents/:type/run` covering success, unknown type, and upstream failure paths.

Coverage of the acceptance criteria in §7 is the definition of done for each work item.

## 10. Open Questions

1. **AI provider and model selection** — which provider(s) does `AiClient` wrap in V1, and is per-agent model configuration needed at launch?
2. **Approval UX** — is approval granted through a UI, an API call, or (interim) a CLI command? V1 needs at least one concrete mechanism to satisfy AC-9.
3. **Message bus scope** — the spec includes messaging hooks, but V1 workflows are strictly sequential via the runner. Is the bus a no-op placeholder in V1, or do agents emit events (e.g., for logging/observability) from day one?
4. **Server framework** — the HTTP layer (`/api/agents/:type/run`) needs a host framework (e.g., Next.js API routes vs. a standalone Node server). This determines the `api/` layout above.
5. **Full-Stack Engineer output format** — "implements code tasks" could mean returning code as artifact content vs. writing files. V1 assumption: code is returned as structured artifact content, not applied to disk. Confirm.
6. **Tenant model** — `AgentContext` carries tenant IDs but V1 has no auth. Is a hardcoded single tenant acceptable for the prototype?

## 11. Future Enhancements (explicitly deferred)

- Parallel task execution and conditional workflow paths.
- Database-backed artifact persistence (interface already designed for this migration).
- Distributed message queues for agent communication.
- Expanded agent capabilities (tool use, retrieval infrastructure beyond V1 research).
- Retry policies and partial-workflow recovery.

## 12. Success Metrics

- All three V1 workflows demonstrably run end-to-end with approval gates functioning (demo-ready).
- Adding a new agent requires touching ≤ 2 files (subclass + factory registration) — verified by adding one during acceptance.
- Adding a new workflow requires zero changes to core runner code.
- 100% of acceptance criteria in §7 covered by passing tests.

# Agency PM Agent: Mastra.ai + MongoDB + Composio

**Research date:** 2026-07-12  
**Prepared for:** PaulWeezy Design — design/development agency

---

## Executive Summary

Build a **Mastra Supervisor PM** with MongoDB Observational Memory and Composio for Slack, Gmail, Linear, GitHub, and Monday.com.

## Agent Roster

```
PM Supervisor
├── Intake Agent    → Slack, Gmail, Monday requests
├── Planner Agent   → break down & assign work
├── Dev Agent       → Linear + GitHub
├── Design Agent    → Monday design boards
├── Sync Agent      → keep all apps aligned
├── Comms Agent     → Slack + Gmail
└── Research Agent  → Composio web search
```

## Stack

| Layer | Technology |
|-------|------------|
| Orchestration | Mastra Supervisor Agent |
| Persistence | MongoDB Atlas + Observational Memory |
| External apps | Composio Tool Router |
| Human reach | Slack + Gmail |

## Sync Pattern

Canonical `work_items` in MongoDB with `externalRefs` per app and `syncHash` for drift detection.

- Linear/GitHub = engineering truth
- Monday.com = client truth
- Slack owner reply wins on conflicts

## Implementation Phases

1. **Foundation** — Slack+Gmail, MongoDB OM, supervisor + Intake/Comms
2. **Work tracking** — Linear+GitHub+Monday, Sync Agent v1
3. **Full PM** — All sub-agents, rubric scorers, scheduled standups

## Sources

- https://mastra.ai/docs/agents/supervisor-agents
- https://mastra.ai/docs/memory/observational-memory
- https://docs.composio.dev/docs/providers/mastra

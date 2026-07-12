# MongoDB in React/Node Agentic Systems

**Research date:** 2026-07-12  
**Stack focus:** React + Node.js / Next.js agentic applications

---

## Executive Summary

For React/Node agentic systems, MongoDB Atlas is the strongest **single-database** choice: it stores agent memory, vector embeddings, session state, tool audit logs, and operational data in one cluster — eliminating the typical Redis + Postgres + Pinecone split.

Three integration paths dominate in 2026:
1. **Vercel AI SDK** + `@mongodb-developer/vercel-ai-memory` (Next.js/React)
2. **Mastra.ai** + `@mastra/mongodb` (Node/TS agents with Observational Memory)
3. **Custom Node** with MongoDB Vector Search + hybrid retrieval (Memongo pattern)

---

## Why MongoDB for Agentic React/Node Apps

| Capability | MongoDB role |
|------------|-------------|
| Short-term memory | Session collections keyed by `sessionId` + TTL |
| Long-term memory | Semantic/episodic collections + Vector Search |
| RAG knowledge base | Vector Search + metadata pre-filtering |
| Agent state | Workflow snapshots, tool call logs |
| User preferences | Document-per-user with embedded preference arrays |
| Observability | Unified audit trail in same DB |

---

## Path 1: Vercel AI SDK + Next.js

**Package:** `@mongodb-developer/vercel-ai-memory`

Five memory tiers: Session, Semantic, Procedural, Episodic, Scratchpad.

```typescript
import { createMongoDBMemory } from '@mongodb-developer/vercel-ai-memory';
import { ToolLoopAgent, isLoopFinished } from 'ai';
import { openai } from '@ai-sdk/openai';

const mongodbMemory = createMongoDBMemory({
  uri: process.env.MONGODB_URI!,
  embedder: openai.embedding('text-embedding-3-small'),
});

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  tools: mongodbMemory({ userId, sessionId }),
  stopWhen: isLoopFinished(),
});
```

**Reference:** `mongodb-developer/personalised-mflix-ai-sdk` — Next.js 16 + React 19.

---

## Path 2: Mastra.ai + @mastra/mongodb

Single Atlas cluster: MongoDBVector, MongoDBStore, Observational Memory (5–40× compression).

Ideal for supervisor + sub-agent PM architectures.

---

## Path 3: Memongo

Open-source MongoDB-native memory framework with HTTP API, MCP server, and React console.

---

## Recommendations for Agency PM Stack

1. MongoDB Atlas as single persistence layer
2. Mastra `@mastra/mongodb` for Observational Memory + vector RAG
3. Custom collections: `work_items`, `sync_events`, `agent_assignments`
4. Next.js API routes for React dashboard
5. Composio for external app integrations

---

## Sources

- https://www.mongodb.com/docs/vector-search/about/ai-agents/
- https://www.npmjs.com/package/@mongodb-developer/vercel-ai-memory
- https://ai-sdk.dev/docs/agents/memory
- https://mastra.ai/blog/build-agents-mastra-mongodb
- https://github.com/romiluz13/Memongo

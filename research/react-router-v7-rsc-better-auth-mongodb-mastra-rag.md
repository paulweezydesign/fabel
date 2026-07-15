# React Router v7 + RSC Deep Dive

**Stack:** React Router v7 (unstable RSC Framework Mode) · React 19 (`Suspense`, `use`, `ViewTransition`) · Better Auth · MongoDB Atlas · Mastra.ai RAG agent

**Research date:** 2026-07-15  
**Audience:** Engineers scaffolding a production-shaped app that can also become a multi-post teaching series  
**Status note:** React Router’s RSC APIs are **experimental** (`unstable_*`). Pin versions tightly and re-read release notes on every bump.

---

## Executive Summary

React Router v7 can run as a full framework with **React Server Components** via the `unstable_rsc-framework-mode` template. That gives you:

1. **Server Components by default** — fetch MongoDB / call Mastra on the server without shipping secrets to the browser  
2. **Loaders/actions that can return React elements** — unique RR RSC capability  
3. **React 19 UX primitives** — `Suspense` streaming islands, `use()` for promise/context consumption, and `ViewTransition` for motion tied to transitions  
4. **First-class Better Auth integration** for RR v7 (resource route + `auth.api.getSession`)  
5. **One MongoDB cluster** for auth sessions, app documents, vector embeddings, and Mastra agent memory  

The reference architecture below is a **“Chat with your data”** app: authenticated users upload/own documents → Mastra chunks + embeds into MongoDB Atlas Vector Search → a RAG agent streams answers in a client chat island, while the rest of the UI stays as Server Components with view-transitioned navigations.

---

## Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (Client Components only where needed)                   │
│  • ChatUI ("use client") — streams tokens                        │
│  • Auth forms / optimistic uploads                               │
│  • <ViewTransition> + RR viewTransition on Links                 │
└───────────────────────────────▲──────────────────────────────────┘
                                │ RSC payload / SSR HTML / fetch
┌───────────────────────────────┴──────────────────────────────────┐
│  React Router v7 RSC Framework Mode                              │
│  • unstable_reactRouterRSC + @vitejs/plugin-rsc                  │
│  • ServerComponent routes · loaders · middleware · resource APIs │
│  • Better Auth handler @ /api/auth/*                             │
│  • Mastra agent resource route @ /api/chat (SSE/stream)          │
└───────────────────────────────▲──────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────────┐
│  MongoDB Atlas (single cluster)                                  │
│  • better-auth collections (user, session, account, …)           │
│  • app docs: documents, document_chunks (ops metadata)           │
│  • @mastra/mongodb MongoDBVector (Atlas Vector Search)           │
│  • MongoDBStore (agent memory / threads)                         │
└──────────────────────────────────────────────────────────────────┘
```

**One sentence for LinkedIn/Medium:**  
*Server Components own data and secrets; Client Components own interaction and streaming; MongoDB owns identity, documents, vectors, and agent memory; Mastra owns the RAG agent loop.*

---

## Part 1 — Scaffold React Router v7 with RSC Enabled

### 1.1 Create from the official template

```bash
npx create-react-router@latest my-app \
  --template remix-run/react-router-templates/unstable_rsc-framework-mode
cd my-app
npm install
```

The template ships SSR, Server Components, `"use client"`, and `"use server"` wired through Vite.

### 1.2 Vite plugin order (non-negotiable)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { unstable_reactRouterRSC as reactRouterRSC } from "@react-router/dev/vite";
import rsc from "@vitejs/plugin-rsc";

export default defineConfig({
  plugins: [
    reactRouterRSC(), // first
    rsc(),            // after RR RSC plugin
  ],
});
```

### 1.3 Mental model: Framework Mode vs Data Mode

| Mode | When to use | You get |
|------|-------------|---------|
| **RSC Framework Mode** | Greenfield RR apps (recommended teaching path) | `routes.ts`, file routing, HMR, Hot Data Revalidation, `ServerComponent` |
| **RSC Data Mode** | Custom bundler/server, maximum control | Lower-level `matchRSCServerRequest`; fewer framework conveniences |

For this research we assume **Framework Mode**.

### 1.4 Route module split (RSC-specific)

A route cannot export both `default` and `ServerComponent`.

| Server export | Client export |
|---------------|---------------|
| `ServerComponent` | `default` |
| `ServerErrorBoundary` | `ErrorBoundary` |
| `ServerLayout` | `Layout` |
| `ServerHydrateFallback` | `HydrateFallback` |

```tsx
// app/routes/dashboard.tsx
import type { Route } from "./+types/dashboard";
import { Outlet } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { ChatIsland } from "~/components/chat-island"; // "use client"

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export function ServerComponent({ loaderData }: Route.ServerComponentProps) {
  return (
    <section>
      <h1>Welcome, {loaderData.user.name}</h1>
      {/* Client island for streaming chat */}
      <ChatIsland userId={loaderData.user.id} />
      <Outlet />
    </section>
  );
}
```

### 1.5 Server-only code: drop `.server` assumptions

In RSC Framework Mode, built-in `.server` / `.client` module conventions are **gone** (to avoid clashing with `"use server"` / `"use client"`). Prefer:

```ts
// app/lib/db.ts
import "server-only";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);
export const db = client.db(process.env.MONGODB_DB_NAME);
```

`@vitejs/plugin-rsc` validates `server-only` / `client-only` at build time. If you must keep `.server.*` filenames during migration, add `vite-env-only`’s `denyImports`.

### 1.6 Loaders that return React elements

RR RSC lets loaders return elements that only ever render on the server:

```tsx
export async function loader() {
  const docs = await db.collection("documents").find().limit(5).toArray();
  return {
    title: "Recent docs",
    list: (
      <ul>
        {docs.map((d) => (
          <li key={String(d._id)}>{d.title}</li>
        ))}
      </ul>
    ),
  };
}
```

**Best practice:** use this for server-composed UI snippets; keep interactive pieces in `"use client"` modules imported into that tree.

### 1.7 Custom entries (auth context, logging)

Optional overrides detected automatically:

- `app/entry.rsc.ts` — RSC server `fetch`
- `app/entry.ssr.ts` — HTML generation
- `app/entry.client.tsx` — hydration

Use `react-router reveal entry.rsc` to inspect defaults before wrapping them (e.g. seed a `RouterContextProvider` for middleware).

### 1.8 Unsupported config (know before you commit)

In RSC Framework Mode these `react-router.config.ts` options are **not** supported yet: `buildEnd`, `presets`, `serverBundles`, `splitRouteModules`, `subResourceIntegrity`.

---

## Part 2 — React 19 Data & Motion Best Practices

### 2.1 Where each API lives

| Concern | Server Components | Client Components | RR Framework |
|---------|-------------------|-------------------|--------------|
| Fetch Mongo / secrets | ✅ async component / loader | ❌ | loaders, middleware |
| `use(promise)` | limited (prefer `await`) | ✅ with Suspense | clientLoader / islands |
| `Suspense` streaming | ✅ boundaries | ✅ | layouts + Await patterns |
| React `<ViewTransition>` | ❌ (Canary/Experimental; client) | ✅ | wrap outlet / lists |
| RR `viewTransition` prop | n/a | Links/Forms | `document.startViewTransition` |

**Teaching tip:** React’s `<ViewTransition>` (Canary/Experimental) and React Router’s `viewTransition` prop are related but different. RR’s prop wraps navigations in the **browser** View Transitions API. React’s component coordinates **Transition / Suspense / useDeferredValue** updates with richer enter/exit/share semantics. In production-stable RR today, start with RR `viewTransition`; add React `<ViewTransition>` once you’re on a React Canary channel (or when it lands in Stable).

### 2.2 Suspense: nested islands, not one giant spinner

```tsx
export function ServerComponent() {
  return (
    <main>
      <header>...</header>
      <Suspense fallback={<DocsSkeleton />}>
        <DocumentsPanel /> {/* async Server Component */}
      </Suspense>
      <Suspense fallback={<ChatSkeleton />}>
        <ChatIsland />
      </Suspense>
    </main>
  );
}

async function DocumentsPanel() {
  const docs = await db.collection("documents").find({}).toArray();
  return <DocList docs={docs} />;
}
```

**Rules:**

1. One Suspense boundary per **independent** data dependency.  
2. Match skeleton dimensions to final content (protect CLS).  
3. Fetch in parallel across sibling Server Components — don’t waterfallee in a single parent `await`.  
4. Prefer Server Component `await` over client `useEffect` fetching.

### 2.3 `use()` for client-side promise/context consumption

```tsx
"use client";
import { Suspense, use, useDeferredValue, useState } from "react";

function SearchResults({ query }: { query: string }) {
  if (!query) return null;
  // promise must be stable (cache by query) or Suspense retriggers forever
  const results = use(searchDocuments(query));
  return <ResultList results={results} />;
}

export function DocumentSearch() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Suspense fallback={<p>Searching…</p>}>
        <SearchResults query={deferred} />
      </Suspense>
    </>
  );
}
```

**`use()` checklist:**

- Only unwrap promises that are **cached** (module-level map, React cache, or router loader data).  
- Pair with `<Suspense>` — `use` throws the promise to the nearest boundary.  
- Combine with `useDeferredValue` so typing stays snappy while results lag.  
- On the server, prefer `await` in async Server Components; save `use()` for client islands and shared promise props.

### 2.4 View transitions — two layers

#### A. React Router (stable on RR Link/Form/navigate)

```tsx
import { Link, useNavigate, useViewTransitionState } from "react-router";

export function DocCard({ id, title }: { id: string; title: string }) {
  const to = `/docs/${id}`;
  const transitioning = useViewTransitionState(to);
  return (
    <Link to={to} viewTransition>
      <h3 style={{ viewTransitionName: transitioning ? "doc-title" : "none" }}>
        {title}
      </h3>
    </Link>
  );
}

// Programmatic
const navigate = useNavigate();
navigate(to, { viewTransition: true });
```

CSS for named transitions:

```css
::view-transition-old(doc-title),
::view-transition-new(doc-title) {
  animation-duration: 280ms;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

#### B. React `<ViewTransition>` (Canary/Experimental)

```tsx
import { Suspense, ViewTransition } from "react";

function DocDetails({ id }: { id: string }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down">
          <Skeleton />
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up">
        <DocBody id={id} />
      </ViewTransition>
    </Suspense>
  );
}
```

Activation triggers: enter, exit, update, share (named shared-element). React calls `startViewTransition` for you — **don’t** nest manual `document.startViewTransition` calls. Always honor `prefers-reduced-motion`.

### 2.5 Combining Suspense + ViewTransition + RR navigation

Recommended pattern for this app:

1. Wrap the routed outlet in RR navigation `viewTransition` Links.  
2. Inside each page, use nested `<Suspense>` for Mongo-backed panels.  
3. Optionally wrap Suspense fallbacks/content in React `<ViewTransition>` when on Canary.  
4. Chat streaming stays outside shared-element transitions (tokens shouldn’t animate per chunk).

---

## Part 3 — Better Auth + MongoDB Persistence

### 3.1 Install

```bash
npm install better-auth mongodb
```

### 3.2 Auth instance (MongoDB adapter)

```ts
// app/lib/auth.server.ts
import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);
export const mongo = client.db(process.env.MONGODB_DB_NAME);

export const auth = betterAuth({
  database: mongodbAdapter(mongo),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  // socialProviders: { github: { ... } },
});

export type Session = typeof auth.$Infer.Session;
```

For lean edge/serverless bundles, Better Auth also documents `better-auth/minimal` + `mongodbAdapter(db)`.

### 3.3 Mount the handler (RR resource route)

```ts
// app/routes/api.auth.$.ts
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
```

### 3.4 Client SDK

```ts
// app/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL only if auth is hosted elsewhere
});
```

Sign-in / sign-up use `authClient.signIn.email` / `signUp.email` with `onSuccess` → `navigate("/dashboard", { viewTransition: true })`.

### 3.5 Server session helpers (middleware-friendly)

```ts
// app/lib/session.ts
import "server-only";
import { redirect } from "react-router";
import { auth } from "./auth.server";

export async function getSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export async function requireUser(request: Request) {
  const session = await getSession(request);
  if (!session?.user) throw redirect("/login");
  return session.user;
}
```

### 3.6 Auth middleware (RR middleware API)

```tsx
// app/routes/dashboard.tsx
import { createContext } from "react-router";
import type { Route } from "./+types/dashboard";
import { getSession } from "~/lib/session";
import { redirect } from "react-router";

export const userContext = createContext<Session["user"] | null>(null);

async function authMiddleware({ request, context }: Route.MiddlewareArgs) {
  const session = await getSession(request);
  if (!session?.user) throw redirect("/login");
  context.set(userContext, session.user);
}

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext)!;
  return { user };
}
```

> Note: middleware naming has moved from `unstable_middleware` toward stable `middleware` in recent RR docs — confirm against your pinned version.

### 3.7 Mongo collections you’ll actually use

| Collection | Owner | Purpose |
|------------|-------|---------|
| `user`, `session`, `account`, `verification` | Better Auth | Identity |
| `documents` | App | uploaded docs metadata (`ownerId`, title, status) |
| `document_chunks` (optional ops mirror) | App | human-readable chunk audit |
| Vector index collection (e.g. `embeddings`) | `@mastra/mongodb` `MongoDBVector` | Atlas Vector Search |
| Mastra memory tables/collections | `MongoDBStore` | threads / messages |

**Tenant isolation rule:** every vector metadata blob must include `ownerId` (or `orgId`) and every query filter must enforce it.

---

## Part 4 — Mastra.ai RAG Pipeline (“Chat with your data”)

### 4.1 Install

```bash
npm install @mastra/core @mastra/rag @mastra/mongodb ai zod
# plus your model provider package, e.g. @ai-sdk/openai
```

### 4.2 Ingest pipeline (chunk → embed → upsert)

```ts
// app/lib/rag/ingest.ts
import "server-only";
import { embedMany } from "ai";
import { MDocument } from "@mastra/rag";
import { MongoDBVector } from "@mastra/mongodb";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

export const vectorStore = new MongoDBVector({
  id: "mongodb-vector",
  uri: process.env.MONGODB_URI!,
  dbName: process.env.MONGODB_DB_NAME!,
});

const INDEX = "user_documents";
const DIM = 1536; // text-embedding-3-small

export async function ensureVectorIndex() {
  await vectorStore.createIndex({
    indexName: INDEX,
    dimension: DIM,
    metric: "cosine",
  });
}

export async function ingestText(opts: {
  ownerId: string;
  documentId: string;
  text: string;
  title: string;
}) {
  const doc = MDocument.fromText(opts.text);
  const chunks = await doc.chunk({
    strategy: "recursive",
    maxSize: 512,
    overlap: 50,
  });

  const { embeddings } = await embedMany({
    model: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
    values: chunks.map((c) => c.text),
  });

  await vectorStore.upsert({
    indexName: INDEX,
    vectors: embeddings,
    metadata: chunks.map((chunk, i) => ({
      text: chunk.text,
      ownerId: opts.ownerId,
      documentId: opts.documentId,
      title: opts.title,
      chunkIndex: i,
    })),
  });
}
```

Wire ingest from a RR `action` on an upload route (Server Action or resource route) after Better Auth verifies the session.

### 4.3 RAG agent + MongoDB memory

```ts
// app/lib/mastra/rag-agent.ts
import "server-only";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { MongoDBStore, MongoDBVector } from "@mastra/mongodb";
import { createVectorQueryTool } from "@mastra/rag";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";
import { Mastra } from "@mastra/core";

const mongoVector = new MongoDBVector({
  id: "mongodb-vector",
  uri: process.env.MONGODB_URI!,
  dbName: process.env.MONGODB_DB_NAME!,
});

const vectorQueryTool = createVectorQueryTool({
  id: "search-user-docs",
  vectorStoreName: "mongodb-vector",
  vectorStore: mongoVector,
  indexName: "user_documents",
  model: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),
  // Prefer databaseConfig / tool instructions that force ownerId filtering
});

export const ragAgent = new Agent({
  id: "rag-agent",
  name: "Document Chat Agent",
  instructions: `You answer questions using the search-user-docs tool.
Only cite passages retrieved for this user. If nothing relevant is found, say so.
Never invent document contents.`,
  model: "openai/gpt-4o",
  tools: { vectorQueryTool },
  memory: new Memory({
    storage: new MongoDBStore({
      id: "mongodb-storage",
      uri: process.env.MONGODB_URI!,
      dbName: process.env.MONGODB_DB_NAME!,
    }),
    options: { generateTitle: true },
  }),
});

export const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { mongoVector },
  storage: new MongoDBStore({
    id: "mongodb-storage",
    uri: process.env.MONGODB_URI!,
    dbName: process.env.MONGODB_DB_NAME!,
  }),
});
```

**Critical security practice:** pass `ownerId` into tool `requestContext` / filters every call so retrieval cannot cross tenants. Treat “chat with *your* data” as a multi-tenant filter problem, not only a prompt instruction.

### 4.4 Streaming chat resource route

```ts
// app/routes/api.chat.ts
import type { ActionFunctionArgs } from "react-router";
import { requireUser } from "~/lib/session";
import { mastra } from "~/lib/mastra/rag-agent";

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const { message, threadId } = await request.json();

  const agent = mastra.getAgent("ragAgent");
  const stream = await agent.stream(message, {
    memory: {
      thread: threadId ?? crypto.randomUUID(),
      resource: user.id, // scopes memory per user
    },
    // Also inject owner filter into tool context here
  });

  // Return a web ReadableStream of text (or AI SDK UI message stream)
  return new Response(stream.textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Thread-Id": threadId ?? "",
    },
  });
}
```

### 4.5 Client chat island (Suspense-friendly shell)

```tsx
"use client";
import { useState, useTransition } from "react";

export function ChatIsland({ userId, threadId }: { userId: string; threadId?: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [pending, startTransition] = useTransition();

  async function send(text: string) {
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    startTransition(async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, threadId }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    });
  }

  return (
    <div data-userid={userId}>
      {/* message list + input */}
      <button disabled={pending} onClick={() => send("What did I upload about Q3?")}>
        Ask
      </button>
    </div>
  );
}
```

Server route wraps the island in Suspense; navigation to `/chat` uses `viewTransition`.

---

## Part 5 — End-to-End Setup Checklist

### Env

```bash
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=fabel
BETTER_AUTH_SECRET=...   # long random
BETTER_AUTH_URL=http://localhost:5173
OPENAI_API_KEY=...       # or your gateway keys
```

### Atlas

1. Create cluster + database user.  
2. Enable **Atlas Vector Search** index on the embeddings collection (dimensions match embedding model).  
3. Network access for your app host.  
4. Optionally use same URI for Better Auth + Mastra Store + Vector.

### App boot sequence

1. Scaffold RR RSC template.  
2. Add Mongo client + `server-only` boundary.  
3. Wire Better Auth (`auth.server`, `api.auth.$`, client).  
4. Protect dashboard with middleware/`requireUser`.  
5. Document upload action → `ingestText`.  
6. Mastra agent + `/api/chat` stream.  
7. Client `ChatIsland` + Suspense shells.  
8. Add `viewTransition` on nav Links + reduced-motion CSS.  
9. (Optional) React Canary `<ViewTransition>` around Suspense fallbacks.

### Suggested folder layout

```
app/
  entry.rsc.ts                 # optional
  lib/
    auth.server.ts
    auth-client.ts
    session.ts
    db.ts
    rag/ingest.ts
    mastra/rag-agent.ts
  routes/
    api.auth.$.ts
    api.chat.ts
    api.documents.upload.ts
    _app.tsx                   # ServerLayout + nav Links
    login.tsx
    dashboard.tsx
    docs.$id.tsx
    chat.tsx
  components/
    chat-island.tsx            # "use client"
    doc-card.tsx               # "use client" if interactive
```

---

## Part 6 — Best Practices (Overall)

### Routing & RSC

1. **Default to `ServerComponent`**; push `"use client"` to leaves (inputs, chat, optimistic UI).  
2. **Donut pattern:** Server layouts pass Client children; Client shells receive Server-rendered `children` as props when needed.  
3. Prefer **middleware + loader** for auth gate/redirects; do heavy UI data fetch in async Server Components when streaming helps.  
4. Loaders remain the right place for **status codes, redirects, cookie writes**.  
5. Pin `react-router`, `@react-router/dev`, `@vitejs/plugin-rsc`, and React to a tested triad — unstable RSC moves quickly.

### Data with React 19

1. Nested Suspense > one page-level spinner.  
2. Cache promises before `use()`.  
3. `useDeferredValue` for search; `useTransition` for chat send / navigation-adjacent updates.  
4. Never fetch secrets or Mongo in Client Components.

### Motion

1. RR `viewTransition` for route changes.  
2. Shared-element `viewTransitionName` only while `useViewTransitionState` is true.  
3. Always ship `prefers-reduced-motion` kills.  
4. Don’t animate token streams.

### Auth

1. Single Better Auth handler route; don’t reimplement cookies.  
2. Server: `auth.api.getSession({ headers: request.headers })` only.  
3. Client: `better-auth/react` SDK.  
4. Password min length ≥ 10; enable email verification before production.

### MongoDB

1. One Atlas cluster, many concerns (auth / docs / vectors / memory).  
2. Index `documents.ownerId`, sessions by token, vector metadata filters.  
3. Enforce tenant filters in **code**, not only in agent instructions.

### Mastra RAG

1. Chunk → embed → upsert at write time; retrieve at query time.  
2. Use `createVectorQueryTool` + instructions that require tool use.  
3. Memory `resource = user.id`, `thread = conversation id`.  
4. Log retrieval scores for eval; add offline RAG evals before claiming accuracy.  
5. Stream replies; don’t block the RSC document request on full generation — keep chat on a resource route.

---

## Part 7 — Teaching / Publishing Outline

| Post | Hook | Demo |
|------|------|------|
| 1 | “React Router can do RSC now (it’s unstable, here’s the template)” | Scaffold + `ServerComponent` |
| 2 | “Suspense islands that actually stream” | Nested Suspense + Mongo list |
| 3 | “`use()` without tears” | Deferred search island |
| 4 | “View transitions in 15 lines of RR” | `Link viewTransition` + CSS |
| 5 | “Better Auth on React Router in one resource route” | Login + middleware |
| 6 | “Chat with *your* MongoDB data via Mastra” | Ingest + RAG agent stream |

Each post ends with: what we shipped, what’s still unstable, exercise for the reader.

---

## Part 8 — Risk Register

| Risk | Mitigation |
|------|------------|
| RR RSC breaking changes | Pin versions; follow changelog; keep non-RSC fallback branch |
| React `<ViewTransition>` Canary-only | Feature-detect / RR `viewTransition` as baseline |
| Vector leakage across users | Mandatory `ownerId` metadata + filter |
| Embedding cost | Batch ingest; choose small embedding model; dedupe unchanged docs |
| Long chat blocks SSR | Separate `/api/chat` stream from document RSC |
| Atlas Vector Search ops | Document index creation; monitor dimensions/metric drift |

---

## Sources

- [React Router — React Server Components](https://reactrouter.com/how-to/react-server-components)
- [React Router — View Transitions](https://reactrouter.com/how-to/view-transitions)
- [React Router — Middleware](https://reactrouter.com/how-to/middleware)
- [React — `Suspense`](https://react.dev/reference/react/Suspense)
- [React — `use`](https://react.dev/reference/react/use)
- [React — `ViewTransition` (Canary/Experimental)](https://react.dev/reference/react/ViewTransition)
- [React Labs — View Transitions, Activity, and more](https://react.dev/blog/2025/04/23/react-labs-view-transitions-activity-and-more)
- [Better Auth — React Router v7 integration](https://www.better-auth.com/docs/integrations/react-router)
- [Better Auth — MongoDB adapter](https://www.better-auth.com/docs/installation)
- [Mastra — RAG overview](https://mastra.ai/docs/rag/overview)
- [Mastra — MongoDB vector store](https://mastra.ai/reference/vectors/mongodb)
- [Mastra — MongoDB storage / memory](https://mastra.ai/reference/storage/mongodb)
- [Mastra — Vector query tool](https://mastra.ai/reference/tools/vector-query-tool)
- SitePoint (2026) — RSC streaming performance patterns (Suspense islands, leaf `"use client"`)

---

## Appendix — Minimal “happy path” sequence diagram

```
User → Link(viewTransition) → /chat
RR RSC → ServerComponent(requireUser) → Suspense → ChatIsland
User types → POST /api/chat
requireUser → mastra.ragAgent.stream({ resource: userId })
Agent → vectorQueryTool (filter ownerId) → MongoDB Atlas Vector Search
Agent → LLM → textStream → Client island renders tokens
MongoDBStore persists thread messages
```

This is the spine to implement, demo, and teach.

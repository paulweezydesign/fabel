# RR RSC Sandbox (Part 1)

Teaching sandbox for **React Router RSC Framework Mode** + **Better Auth** + **MongoDB** + **React Suspense**, based on the fabel research doc.

> Experimental: uses React Router’s unstable RSC Vite plugin (`unstable_reactRouterRSC`). Pin versions and read release notes before upgrading.

## What Part 1 includes

- Official RSC Framework Mode template (React Router 8 / RSC)
- `ServerComponent` routes (home, login, signup, dashboard)
- Better Auth email/password with MongoDB adapter
- Protected dashboard via `requireUser`
- Nested `<Suspense>` around an async Server Component document list
- `viewTransition` on navigation Links
- In-memory MongoDB fallback when `MONGODB_URI` is unset (easy local demos)

## Quick start

```bash
cd examples/rr7-rsc-rag
cp .env.example .env   # optional
npm install
npm run dev
```

Open `http://localhost:5173` (or whichever port Vite prints) → **Create account** → dashboard shows a Suspense skeleton (~900ms) then seeded demo documents.

Better Auth trusts `localhost` / `127.0.0.1` on any port so a Vite port hop does not cause `Invalid origin`.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | RSC dev server |
| `npm test` | Vitest unit tests (session + documents) |
| `npm run typecheck` | `react-router typegen` + `tsc` |
| `npm run build` | Production build |

### Atlas (optional)

Set `MONGODB_URI` and `MONGODB_DB_NAME` in `.env` to use MongoDB Atlas instead of the in-memory server.

## Roadmap (later parts)

1. ~~Scaffold + auth + Suspense dashboard~~ (this folder)
2. `use()` + deferred search island
3. Richer view transitions / shared elements
4. Document upload + Mastra chunk/embed into `MongoDBVector`
5. Streaming RAG chat agent (`/api/chat`)

## Related research

See `research/react-router-v7-rsc-better-auth-mongodb-mastra-rag.md` on branch `cursor/rr7-rsc-mastra-research-e34f` (or after merge on `main`).

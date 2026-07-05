# AGENTS.md

## Cursor Cloud specific instructions

### Stack & package manager

`fabel` is a **TypeScript / Node.js** project managed with **pnpm** (see
`packageManager` in `package.json` and `pnpm-lock.yaml`). Node `v22.x`, `npm`,
`pnpm`, and `yarn` are all preinstalled on the VM — no extra system deps.

### Commands (defined in `package.json` scripts)

- `pnpm run dev` — standalone Node HTTP server via `tsx watch` (hot reload).
  Honors `PORT` (default `3000`).
- `pnpm start` — run the server once (no watch).
- `pnpm test` — Vitest (all `src/**/*.test.ts`); `pnpm test:watch` for watch.
- `pnpm run typecheck` — `tsc --noEmit`.
- `pnpm run lint` — ESLint (flat config).
- `pnpm run build` — emits `dist/` via `tsconfig.build.json`.

### Architecture (matches PRD §5 layout under `src/`)

- `src/core` — `AgentType`, `AgentContext`, `AgentRunResult`, `BaseAgent`,
  `AgentFactory`, `ArtifactStore` (in-memory + file), `WorkflowRunner`.
- `src/agents` — the seven specialized agents.
- `src/services` — `AiClient` (+ `StubAiClient`), `logger`, `message-bus`.
- `src/workflows` — the three V1 workflow definitions (pure data).
- `src/api` + `src/server.ts` — HTTP layer; `src/client` — browser `run()` wrapper.
- `src/app.ts` — composition root (`createApp()`), the place to swap services.
- `src/testing` — test-only helpers (excluded from the build).

### Non-obvious notes

- **ESM import extensions:** intra-repo imports use explicit `.js` suffixes
  (e.g. `./agent-types.js`) even though sources are `.ts`. This is required for
  Node ESM at runtime (`tsx`/`node`); keep it when adding files.
- **AI provider is auto-selected.** `createApp()` calls
  `selectAiClient(process.env)` (`src/services/openai-ai-client.ts`): a real
  `OpenAiClient` when `OPENAI_API_KEY` is set, else the offline `StubAiClient`
  (so the server and workflows still run end-to-end with no key). Relevant env:
  `OPENAI_API_KEY` (required for the real path), `OPENAI_BASE_URL` (default
  `https://api.openai.com/v1`), `OPENAI_MODEL` (default `gpt-4o-mini`). Override
  entirely via `createApp({ aiClient })`. `OpenAiClient` uses global `fetch`
  (no SDK) and accepts an injectable `fetchImpl` so tests never hit the network.
- **Approval UX (PRD §10 #2) = API call.** Workflows pause at
  `needs_review`; resume with `POST /api/workflows/:workflowId/approve` body
  `{ "stepId": "<gate step id>" }`.
- **State is in-memory.** The default `ArtifactStore` and the runner's run
  registry reset on every server restart; started workflows do not survive a
  reload. A `FileArtifactStore` exists behind the same interface.
- **pnpm build scripts:** `esbuild` is pre-approved via
  `pnpm.onlyBuiltDependencies` in `package.json`, so `pnpm install` is
  non-interactive. Do not run `pnpm approve-builds` (interactive).
- **TDD is the workflow:** every module has co-located `*.test.ts`; add tests
  first (red → green) when extending.

### Update script behavior

The registered startup update script is **dependency-only and guarded**: it
auto-selects the package manager from the lockfile (`pnpm-lock.yaml` → pnpm,
etc.). With `pnpm-lock.yaml` committed it runs `pnpm install`.

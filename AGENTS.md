# AGENTS.md

## Cursor Cloud specific instructions

### Current repository state (greenfield)

As of this writing, `fabel` is a **greenfield repository**. The only tracked
content is:

- `README.md` — placeholder (`# fabel`).
- `prd/v1-agent-powered-agency-platform.md` — the V1 PRD (the source of truth
  for what will be built).

There is **no application code, `package.json`, lockfile, test runner, or build
config yet**. Consequently there is nothing to build or run, and there are no
`lint` / `test` / `build` / `dev` commands defined. Do not expect a runnable
service until the project is scaffolded per the PRD.

### Intended stack (per the PRD)

The PRD specifies **TypeScript / Node.js** with mandatory test-driven
development. The server framework, AI provider, and package manager are
explicit open questions (PRD §10) and are intentionally undecided. Do not lock
these in unless the task asks you to.

### Toolchain available on the VM (verified)

The base image already provides everything the intended stack needs — no extra
system dependencies are required:

- Node.js `v22.x`, `npm`, `pnpm`, and `yarn` are all preinstalled.
- The TypeScript dev flow was verified end-to-end in a throwaway sandbox
  (not committed): `npm install`, `tsc --noEmit`, running `.ts` via `tsx`, and
  `vitest run` all work.

### Update script behavior

The registered startup update script is **dependency-only and guarded**: it
installs JS dependencies only if a manifest exists, auto-selecting the package
manager from the lockfile (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
`package-lock.json` → `npm ci`, otherwise `package.json` → `npm install`). While
the repo is greenfield it is a no-op. Once the project is scaffolded, this
script will pick up dependencies automatically without changes.

### Once code exists

After scaffolding, prefer the package manager matching the committed lockfile,
and use the `scripts` defined in `package.json` for `dev` / `test` / `lint` /
`build`. Update this section with any non-obvious run/startup caveats you
discover (e.g. required env vars for the `AiClient`, or how the API server is
started).

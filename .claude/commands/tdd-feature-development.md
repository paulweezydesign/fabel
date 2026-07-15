---
name: tdd-feature-development
description: Workflow command scaffold for tdd-feature-development in fabel.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /tdd-feature-development

Use this workflow when working on **tdd-feature-development** in `fabel`.

## Goal

Implements a new core feature or service using test-driven development (TDD). Each feature is added with its implementation file and a corresponding test file, often in pairs, and sometimes involves related service or contract files.

## Common Files

- `src/core/*.ts`
- `src/core/*.test.ts`
- `src/services/*.ts`
- `src/testing/*.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or update the implementation file for the new feature/service (e.g., src/core/feature.ts).
- Create or update the corresponding test file (e.g., src/core/feature.test.ts).
- If needed, add or update related service or contract files (e.g., src/services/service.ts, src/testing/doubles.ts).

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
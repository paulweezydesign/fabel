```markdown
# fabel Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and workflows used in the `fabel` TypeScript codebase, which is built on the Next.js framework. You'll learn the project's coding conventions, how to implement new features using test-driven development (TDD), and how to write and organize tests with Vitest.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example: `user-service.ts`, `feature.test.ts`

### Import Style
- Use **relative imports** for modules within the codebase.
  - Example:
    ```typescript
    import { fetchUser } from './user-service'
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // In user-service.ts
    export function fetchUser(id: string) { ... }
    ```

### Commit Patterns
- Commit messages are **freeform**, sometimes with prefixes.
- Average commit message length: **74 characters**.

## Workflows

### tdd-feature-development
**Trigger:** When someone wants to add a new core feature or service following TDD practices.  
**Command:** `/new-core-feature-tdd`

1. **Create or update the implementation file** for the new feature or service.
   - Example: `src/core/feature.ts`
2. **Create or update the corresponding test file**.
   - Example: `src/core/feature.test.ts`
3. **If needed, add or update related service or contract files**.
   - Examples: `src/services/service.ts`, `src/testing/doubles.ts`

#### Example
```typescript
// src/core/calculate-sum.ts
export function calculateSum(a: number, b: number): number {
  return a + b
}
```

```typescript
// src/core/calculate-sum.test.ts
import { describe, it, expect } from 'vitest'
import { calculateSum } from './calculate-sum'

describe('calculateSum', () => {
  it('adds two numbers', () => {
    expect(calculateSum(2, 3)).toBe(5)
  })
})
```

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test file pattern:** Files end with `.test.ts` and are placed alongside the implementation or in relevant directories.
- **Test example:**
  ```typescript
  // src/core/feature.test.ts
  import { describe, it, expect } from 'vitest'
  import { featureFunction } from './feature'

  describe('featureFunction', () => {
    it('should behave as expected', () => {
      expect(featureFunction()).toBe(/* expected value */)
    })
  })
  ```

## Commands

| Command                | Purpose                                             |
|------------------------|-----------------------------------------------------|
| /new-core-feature-tdd  | Start a new core feature or service using TDD       |
```

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/server.ts"],
      // Thresholds are set slightly below the current actual coverage
      // (statements/lines ~95.1, functions ~92.3, branches ~91.0) so the
      // suite fails if coverage regresses while staying deterministic.
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 85,
        branches: 85,
      },
    },
  },
});

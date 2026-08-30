import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "tests/dsh-isolated-profile-evidence.test.ts", "node_modules/**", "**/node_modules/**", "lib/**", "artifacts/**", "test-results/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
  },
});

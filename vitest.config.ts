import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**", "lib/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/dsh-isolated-profile-evidence.test.ts"],
    testTimeout: 120_000,
  },
});

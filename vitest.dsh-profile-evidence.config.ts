import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/dsh-isolated-profile-evidence.test.ts"],
    // A clean profile probe can include bundle build/pack, offline installation,
    // Cordis boot, and 55 Skill read-backs on slower Windows runners.
    testTimeout: 720_000,
  },
});

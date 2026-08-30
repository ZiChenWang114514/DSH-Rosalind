import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [{
    name: "dsh-rosalind-text-assets",
    enforce: "pre",
    load(id) {
      if (!/\.(aln-fasta|pdb)$/.test(id)) return null;
      return `export default ${JSON.stringify(readFileSync(id, "utf8"))};`;
    },
  }],
  test: {
    environment: "node",
    // Keep native ffmpeg and child-process integration tests from exhausting a
    // busy Windows host when the full suite runs alongside type generation.
    maxWorkers: 4,
    // Several NGS tests launch and terminate real child processes. On a busy
    // Windows host those operations can exceed Vitest's 5 second default even
    // though the service's own state deadlines remain intentionally short.
    testTimeout: 60_000,
    // Browser journeys, build outputs, generated artifacts, and static assets
    // are verified by their dedicated commands rather than by unit discovery.
    exclude: ["tests/e2e/**", "tests/dsh-isolated-profile-evidence.test.ts", "node_modules/**", "**/node_modules/**", "lib/**", "artifacts/**", "test-results/**", "assets/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
  },
});

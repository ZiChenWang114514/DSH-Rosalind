import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "lib",
  format: "esm",
  dts: false,
  sourcemap: true,
  clean: true,
  outExtensions: () => ({ js: ".js" }),
  deps: {
    neverBundle: [/^@deepseek-ai\//, /^react(?:\/.*)?$/, /^node:/],
  },
});

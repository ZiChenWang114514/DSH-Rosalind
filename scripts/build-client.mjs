import { build } from "esbuild";

await build({
  entryPoints: ["src/client/index.tsx"],
  outfile: "lib/client.js",
  bundle: true,
  platform: "browser",
  format: "cjs",
  target: ["es2022"],
  jsx: "automatic",
  loader: { ".aln-fasta": "text", ".pdb": "text" },
  sourcemap: true,
  legalComments: "none",
  external: ["react", "react/*", "@deepseek-ai/*"],
  banner: {
    js: `window.__ModuleLoader__.load({\n  id: "@zichenwang114514/dsh-rosalind",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;`,
  },
  footer: {
    js: `    return module.exports;\n  }\n});`,
  },
  logLevel: "info",
});

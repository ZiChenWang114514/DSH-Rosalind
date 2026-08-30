import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const result = await build({
  entryPoints: ["scripts/preview-entry.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  loader: { ".html": "text", ".aln-fasta": "text", ".pdb": "text" },
  logLevel: "silent",
});
const javascript = result.outputFiles[0].text;

/**
 * Build real NGS session evidence with the production NgsService so the
 * release preview demonstrates the app's evidence bridge over genuine host
 * output (bundled workflow catalogue, local compute targets, empty registry).
 */
async function realNgsEvidence() {
  const bundled = await build({
    entryPoints: ["scripts/ngs-evidence-entry.ts"],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: ["node22"],
    logLevel: "silent",
  });
  const temporary = join(mkdtempSync(join(tmpdir(), "dsh-rosalind-preview-ngs-")), "evidence.mjs");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(temporary, bundled.outputFiles[0].text);
  try {
    const module = await import(pathToFileURL(temporary).href);
    return await module.collectEvidence();
  } catch (error) {
    console.warn(`preview: real NGS evidence unavailable (${error instanceof Error ? error.message : String(error)}); serving empty evidence.`);
    return { ngs: {} };
  } finally {
    rmSync(join(temporary, ".."), { recursive: true, force: true });
  }
}

const ngsEvidence = process.env.DSH_ROSALIND_PREVIEW_NGS_EVIDENCE === "0" ? { ngs: {} } : await realNgsEvidence();
const evidenceScript = `window.__DSH_ROSALIND_SESSION_EVIDENCE__ = ${JSON.stringify(ngsEvidence)};`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH-Rosalind preview</title><script>${evidenceScript}</script></head><body><div id="root"></div><script src="/preview.js"></script></body></html>`;
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }
  if (request.url === "/preview.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    response.end(javascript);
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
});
server.listen(4175, "127.0.0.1", () => console.log("DSH-Rosalind preview: http://127.0.0.1:4175"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));

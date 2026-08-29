import { build } from "esbuild";
import { createServer } from "node:http";

const result = await build({
  entryPoints: ["scripts/preview-entry.tsx"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  logLevel: "silent",
});
const javascript = result.outputFiles[0].text;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DSH-Rosalind preview</title></head><body><div id="root"></div><script src="/preview.js"></script></body></html>`;
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

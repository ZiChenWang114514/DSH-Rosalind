import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const client = readFileSync("lib/client.js", "utf8");
const expectedInject = [
  "@deepseek-ai/dsh-client-runtime",
  "@deepseek-ai/dsh-client-ui-conversation",
  "@deepseek-ai/dsh-client-ui-settings",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-tool",
];
const failures = [];
if (pkg.dsh?.bundle?.patch !== "./cordis.patch.yml") failures.push("package.json is missing the DSH bundle patch declaration");
if (JSON.stringify(pkg.dsh?.client?.inject) !== JSON.stringify(expectedInject)) failures.push("DSH client inject list differs from the 0.1.1-rc.2 contract");
if (!client.startsWith("window.__ModuleLoader__.load({")) failures.push("lib/client.js is not a DSH browser module");
if (!client.includes('id: "@zichenwang114514/dsh-rosalind"')) failures.push("lib/client.js has the wrong module ID");
if (!client.includes("return module.exports;")) failures.push("lib/client.js does not return its exports");
if (!client.includes("priority:-20") && !client.includes("priority: -20")) failures.push("single-slot contributions do not shadow the shipped DSH entries safely");
if (!client.includes("color-scheme: dark")) failures.push("client bundle does not recognize the DSH dark-theme signal");
for (const path of ["lib/index.js", "lib/client.js", "lib/types/index.d.ts", "lib/types/client/index.d.ts", "cordis.patch.yml"]) {
  try { if (statSync(path).size === 0) failures.push(`${path} is empty`); } catch { failures.push(`${path} is missing`); }
}
const gzipBytes = gzipSync(Buffer.from(client)).byteLength;
if (gzipBytes > 600_000) failures.push(`client bundle is ${gzipBytes} gzip bytes; expected at most 600000`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`DSH bundle contract passed; client is ${client.length} bytes (${gzipBytes} gzip bytes).`);

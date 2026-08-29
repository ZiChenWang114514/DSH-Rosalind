import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = [
  "README.md",
  "README.zh-CN.md",
  "CONTRIBUTING.md",
  "docs/architecture.md",
  "docs/providers.md",
  "docs/showcases.md",
  "docs/verification.md",
];
const failures = [];
for (const file of files) {
  if (!existsSync(file)) {
    failures.push(`${file}: missing`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    const decoded = decodeURIComponent(target.replace(/^<|>$/g, ""));
    if (!existsSync(resolve(dirname(file), decoded))) failures.push(`${file}: missing link target ${target}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Checked ${files.length} documentation files and their local links.`);

import path from "node:path";
import { validateShowcases } from "./lib/showcase-data.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const report = await validateShowcases(repositoryRoot);
if (!report.ok) {
  console.error(`Showcase validation failed with ${report.errors.length} error(s):`);
  for (const error of report.errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Showcase validation passed: ${report.pluginCount} plugins, ${report.showcaseCount}/23 ready showcases, ${report.fileCount} parsed files.`);
  console.log(JSON.stringify({ parsedByType: report.parsedByType, acceptance: report.acceptance }, null, 2));
}

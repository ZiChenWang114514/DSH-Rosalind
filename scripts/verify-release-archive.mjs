#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, "$1:"));
const archive = resolve(process.argv[2] ?? "zichenwang114514-dsh-rosalind-0.3.0.tgz");
const output = resolve(process.argv[3] ?? "release/v0.3.0-archive-verification.json");

function runNode(script, args = [], environment = process.env) {
  return execFileSync(process.execPath, [resolve(root, script), ...args], {
    cwd: root,
    env: environment,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 180_000,
  });
}

const packedInspection = runNode("scripts/check-packed-bundle.mjs", [archive]).trim();
const verifierOutput = runNode("scripts/verify-dsh-registration.mjs", [], {
  ...process.env,
  DSH_ROSALIND_PROFILE_ARCHIVE: archive,
});
const verifier = JSON.parse(verifierOutput);
const profile = verifier.isolatedProfileEvidence;
const installation = profile?.installation;
const mount = profile?.mount;
if (!verifier.ok || installation?.archiveKind !== "explicit-tgz" || installation?.releaseArchiveValidated !== true || mount == null) {
  throw new Error("The selected archive did not complete explicit clean-profile verification.");
}

const bytes = statSync(archive).size;
const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
if (installation.archiveBytes !== bytes || installation.archiveSha256 !== sha256) {
  throw new Error("The clean-profile verifier reported an archive identity that differs from the selected file.");
}

const report = {
  schemaVersion: 1,
  status: "passed",
  recordedAt: new Date().toISOString(),
  archive: basename(archive),
  archiveBytes: bytes,
  archiveSha256: sha256,
  archiveKind: installation.archiveKind,
  releaseArchiveValidated: true,
  dshVersion: installation.dshVersion,
  cleanProfile: mount.profile,
  registration: mount.registration,
  representatives: mount.representatives,
  cancellation: mount.cancellation,
  execution: mount.execution,
  packedInspection,
};

mkdirSync(resolve(output, ".."), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

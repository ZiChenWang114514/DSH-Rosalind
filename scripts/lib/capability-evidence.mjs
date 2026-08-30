export function normaliseCapabilityEvidenceFile(file) {
  return String(file ?? "").split("\\").join("/");
}

export function publicVitestCommand(args, reportPath) {
  const publicReportPath = `<repo>/${normaliseCapabilityEvidenceFile(reportPath).replace(/^\/+/, "")}`;
  const publicArgs = args.map((arg) => (
    typeof arg === "string" && arg.startsWith("--outputFile=") ? `--outputFile=${publicReportPath}` : arg
  ));
  return `npx vitest ${publicArgs.join(" ")}`;
}

export function hasPassedVitestCase(machineRecord, evidence) {
  if (typeof evidence?.testCase !== "string" || evidence.testCase.length === 0) return false;
  return Array.isArray(machineRecord?.testCases) && machineRecord.testCases.some((testCase) => (
    normaliseCapabilityEvidenceFile(testCase.file) === normaliseCapabilityEvidenceFile(evidence.path)
    && testCase.fullName === evidence.testCase
    && testCase.status === "passed"
  ));
}

export function hasArchiveIdentity(machineRecord) {
  const installation = machineRecord?.profileInstallation;
  return Boolean(
    installation
    && typeof installation.archive === "string" && installation.archive.endsWith(".tgz")
    && Number.isInteger(installation.archiveBytes) && installation.archiveBytes > 0
    && typeof installation.archiveSha256 === "string" && /^[a-f0-9]{64}$/i.test(installation.archiveSha256)
    && typeof installation.archiveSource === "string" && installation.archiveSource.length > 0
    && ["explicit-tgz", "source-smoke"].includes(installation.archiveKind)
    && typeof installation.releaseArchiveValidated === "boolean"
  );
}

export function sanitizeVitestReport(value, privateRoots) {
  const roots = [...new Set((privateRoots ?? [])
    .filter((root) => typeof root === "string" && root.length > 0)
    .flatMap((root) => [root, root.split("\\").join("/")]))]
    .sort((left, right) => right.length - left.length);
  const visit = (current) => {
    if (typeof current === "string") {
      return roots.reduce((text, root) => text.split(root).join(root === roots[0] || root === roots[1] ? "<repo>" : "<user-profile>"), current);
    }
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === "object") {
      return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, visit(item)]));
    }
    return current;
  };
  return visit(value);
}

export function npmArchiveBaseName(pkg) {
  if (typeof pkg?.name !== "string" || pkg.name.length === 0) {
    throw new Error("package.json must declare a package name.");
  }
  if (typeof pkg?.version !== "string" || pkg.version.length === 0) {
    throw new Error("package.json must declare a package version.");
  }
  return `${pkg.name.replace(/^@/, "").replace(/\//g, "-")}-${pkg.version}.tgz`;
}

export function releaseVerificationReportPath(pkg) {
  npmArchiveBaseName(pkg);
  return `release/v${pkg.version}-archive-verification.json`;
}

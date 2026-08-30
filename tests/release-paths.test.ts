import { describe, expect, it } from "vitest";

// The release scripts run directly in Node before TypeScript compilation.
// @ts-expect-error The Node-side helper has no emitted declaration file.
import { npmArchiveBaseName, releaseVerificationReportPath } from "../scripts/lib/release-paths.mjs";

describe("release artifact paths", () => {
  it("derives the scoped npm archive and evidence report from package metadata", () => {
    const pkg = { name: "@zichenwang114514/dsh-rosalind", version: "0.4.0-rc.1" };

    expect(npmArchiveBaseName(pkg)).toBe("zichenwang114514-dsh-rosalind-0.4.0-rc.1.tgz");
    expect(releaseVerificationReportPath(pkg)).toBe("release/v0.4.0-rc.1-archive-verification.json");
  });

  it("rejects incomplete package metadata", () => {
    expect(() => npmArchiveBaseName({ version: "0.4.0" })).toThrow("package name");
    expect(() => releaseVerificationReportPath({ name: "dsh-rosalind" })).toThrow("package version");
  });
});

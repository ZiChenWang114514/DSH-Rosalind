import { describe, expect, it } from "vitest";

// The verification helper is deliberately plain Node ESM because the release
// validator runs before TypeScript is compiled.
// @ts-expect-error The Node-side helper has no emitted declaration file.
import { capabilityContentDigest, hasArchiveIdentity, hasPassedVitestCase, publicVitestCommand, sanitizeVitestReport } from "../scripts/lib/capability-evidence.mjs";

describe("capability execution evidence", () => {
  const evidence = {
    path: "tests/structure-runtime.test.ts",
    testCase: "StructureService local raster and scientific analyses renders GFP coordinates to a real PNG and retains a reproducible rendering record",
  };

  it("uses a source digest that is stable across worktree line endings", () => {
    expect(capabilityContentDigest("alpha\nbeta\n")).toBe(capabilityContentDigest("alpha\r\nbeta\r\n"));
    expect(capabilityContentDigest("alpha\nbeta\n")).toBe(capabilityContentDigest("alpha\rbeta\r"));
    expect(capabilityContentDigest("alpha\nbeta\n")).not.toBe(capabilityContentDigest("alpha\ngamma\n"));
  });

  it("accepts only the exact passed Vitest case for a capability", () => {
    const record = { testCases: [{ ...evidence, file: evidence.path, fullName: evidence.testCase, status: "passed" }] };
    expect(hasPassedVitestCase(record, evidence)).toBe(true);
  });

  it("rejects skipped, absent, and merely similarly named cases", () => {
    expect(hasPassedVitestCase({ testCases: [{ file: evidence.path, fullName: evidence.testCase, status: "skipped" }] }, evidence)).toBe(false);
    expect(hasPassedVitestCase({ testCases: [{ file: evidence.path, fullName: `${evidence.testCase} extra`, status: "passed" }] }, evidence)).toBe(false);
    expect(hasPassedVitestCase({ testCases: [] }, evidence)).toBe(false);
  });

  it("requires a complete archive identity and separates source smoke from a selected tgz", () => {
    const base = {
      archive: "dsh-rosalind-0.3.0.tgz",
      archiveBytes: 123,
      archiveSha256: "a".repeat(64),
      archiveSource: "DSH_ROSALIND_PROFILE_ARCHIVE",
      archiveKind: "explicit-tgz",
      releaseArchiveValidated: true,
    };
    expect(hasArchiveIdentity({ profileInstallation: base })).toBe(true);
    expect(hasArchiveIdentity({ profileInstallation: { ...base, archiveKind: "source-smoke", releaseArchiveValidated: false } })).toBe(true);
    expect(hasArchiveIdentity({ profileInstallation: { ...base, archiveSha256: "not-a-digest" } })).toBe(false);
    expect(hasArchiveIdentity({ profileInstallation: { ...base, archiveBytes: 0 } })).toBe(false);
  });

  it("removes repository and user-profile paths from public Vitest reports", () => {
    const report = {
      name: "C:/Users/researcher/Documents/DSH-Rosalind/tests/runtime.test.ts",
      failureMessages: ["at C:\\Users\\researcher\\Documents\\DSH-Rosalind\\tests\\runtime.test.ts:10:2"],
      temp: "C:/Users/researcher/AppData/Local/Temp/profile/package.json",
    };
    const sanitized = sanitizeVitestReport(report, [
      "C:\\Users\\researcher\\Documents\\DSH-Rosalind",
      "C:\\Users\\researcher",
    ]);
    expect(sanitized).toEqual({
      name: "<repo>/tests/runtime.test.ts",
      failureMessages: ["at <repo>\\tests\\runtime.test.ts:10:2"],
      temp: "<user-profile>/AppData/Local/Temp/profile/package.json",
    });
  });

  it("writes public evidence commands with repository-relative report paths", () => {
    const command = publicVitestCommand([
      "run",
      "tests/runtime.test.ts",
      "--reporter=json",
      "--outputFile=C:\\Users\\researcher\\Documents\\DSH-Rosalind\\capabilities\\evidence\\fixture.json",
    ], "capabilities/evidence/fixture.json");
    expect(command).toBe("npx vitest run tests/runtime.test.ts --reporter=json --outputFile=<repo>/capabilities/evidence/fixture.json");
    expect(command).not.toContain("C:\\Users");
  });
});

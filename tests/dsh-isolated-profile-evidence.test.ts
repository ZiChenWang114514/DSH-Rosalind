import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("isolated DSH profile evidence", () => {
  it("installs the packed bundle, mounts the real DSH services, and records offline behavior", () => {
    const output = execFileSync(process.execPath, ["scripts/verify-dsh-registration.mjs"], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        DSH_ROSALIND_ENABLE_LIVE_NETWORK: "",
      },
    });
    const report = JSON.parse(output) as {
      isolatedProfileEvidence: {
        installation: { configIncludedRosalind: boolean; profileBundles: string[] };
        mount: {
          registration: { totalTools: number; rosalindTools: number; skillsListed: number; skillsReadBack: number };
          skills: Array<{ loaded: boolean; contentBytes: number }>;
          representatives: Record<string, { result: { host: string; scientificErrorCode: string | null } }>;
          execution: { localProfileMount: boolean; fixtureOrLocalExecution: boolean; publicServiceExecution: { attempted: boolean } };
        };
        cleanup: { removed: boolean };
      };
    };
    const evidence = report.isolatedProfileEvidence;

    expect(evidence.installation.configIncludedRosalind).toBe(true);
    expect(evidence.installation.profileBundles).toContain("@zichenwang114514/dsh-rosalind");
    expect(evidence.mount.registration).toMatchObject({ rosalindTools: 13, skillsListed: 55, skillsReadBack: 55 });
    expect(evidence.mount.registration.totalTools).toBeGreaterThanOrEqual(136);
    expect(evidence.mount.skills).toHaveLength(55);
    expect(evidence.mount.skills.every((skill) => skill.loaded && skill.contentBytes > 0)).toBe(true);
    expect(Object.keys(evidence.mount.representatives).sort()).toEqual([
      "databases", "literature", "ngs", "rosalind", "sequence", "slide", "structure",
    ]);
    expect(evidence.mount.representatives.rosalind!.result.host).toBe("success");
    expect(evidence.mount.representatives.literature!.result.scientificErrorCode).toBe("NETWORK_NOT_AUTHORIZED");
    expect(evidence.mount.representatives.databases!.result.scientificErrorCode).toBe("NETWORK_NOT_AUTHORIZED");
    expect(evidence.mount.execution).toMatchObject({
      localProfileMount: true,
      fixtureOrLocalExecution: true,
      publicServiceExecution: { attempted: false },
    });
    expect(evidence.cleanup.removed).toBe(true);
  }, 120_000);
});

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const execFileAsync = promisify(execFile);

describe("isolated DSH profile evidence", () => {
  it("installs the selected packed bundle, mounts the real DSH services, and records offline behavior", async () => {
    const { stdout: output } = await execFileAsync(process.execPath, ["scripts/verify-dsh-registration.mjs"], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env: {
        ...process.env,
        DSH_ROSALIND_ENABLE_LIVE_NETWORK: "",
      },
    });
    const report = JSON.parse(output) as {
      isolatedProfileEvidence: {
        installation: { archive: string; archiveSha256: string; archiveBytes: number; archiveSource: string; archiveKind: "explicit-tgz" | "source-smoke"; releaseArchiveValidated: boolean; configIncludedRosalind: boolean; profileBundles: string[] };
        mount: {
          registration: { totalTools: number; bundleTools: number; rosalindTools: number; skillsListed: number; skillsReadBack: number };
          skills: Array<{ loaded: boolean; contentBytes: number }>;
          representatives: Record<string, { result: { host: string; scientificErrorCode: string | null } }>;
          execution: { localProfileMount: boolean; fixtureOrLocalExecution: boolean; publicServiceExecution: { attempted: boolean } };
        };
        cleanup: { removed: boolean };
      };
    };
    const evidence = report.isolatedProfileEvidence;
    const selectedArchive = process.env.DSH_ROSALIND_PROFILE_ARCHIVE;

    if (selectedArchive) {
      const archive = resolve(selectedArchive);
      expect(existsSync(archive)).toBe(true);
      expect(statSync(archive).size).toBeGreaterThan(0);
      expect(evidence.installation.archive).toBe(archive.split(/[\\/]/).at(-1));
      expect(evidence.installation.archiveBytes).toBe(statSync(archive).size);
      expect(evidence.installation.archiveSha256).toBe(createHash("sha256").update(readFileSync(archive)).digest("hex"));
      expect(evidence.installation.archiveSource).toBe("DSH_ROSALIND_PROFILE_ARCHIVE");
      expect(evidence.installation.archiveKind).toBe("explicit-tgz");
      expect(evidence.installation.releaseArchiveValidated).toBe(true);
    } else {
      expect(evidence.installation.archiveKind).toBe("source-smoke");
      expect(evidence.installation.releaseArchiveValidated).toBe(false);
    }

    expect(evidence.installation.configIncludedRosalind).toBe(true);
    expect(evidence.installation.profileBundles).toContain("@zichenwang114514/dsh-rosalind");
    expect(evidence.mount.registration).toMatchObject({ bundleTools: 140, rosalindTools: 13, skillsListed: 55, skillsReadBack: 55 });
    expect(evidence.mount.registration.totalTools).toBeGreaterThanOrEqual(140);
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
  }, 720_000);
});

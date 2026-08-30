import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SequenceService } from "../src/host/science/sequence.js";

function context(session: object, packageRoot: string) {
  return { session, packageRoot, signal: new AbortController().signal };
}

describe("SequenceService alignment and evidence tracks", () => {
  it("creates a deterministic Needleman-Wunsch derived alignment with an internal gap", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-align-"));
    const source = join(root, "raw.fasta");
    writeFileSync(source, ">first\nAAAA\n>second\nACAAA\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: source }, context(session, root));
    const aligned = await service.execute("sequence.align", { sessionId: opened.viewerSessionId, algorithm: "builtin-pairwise", recordIds: ["first", "second"] }, context(session, root));
    const artifact = aligned.artifact as Record<string, unknown>;
    expect(artifact.alignedLength).toBe(5);
    const provenance = artifact.provenance as Record<string, unknown>;
    expect(provenance.engine).toBe("needleman-wunsch");
    const artifacts = await service.execute("sequence.query_viewer", { sessionId: opened.viewerSessionId, target: "artifacts" }, context(session, root));
    const records = ((artifacts.artifacts as Array<Record<string, unknown>>)[0]!.records as Array<{ id: string; sequence: string }>);
    expect(records.map((record) => record.sequence)).toEqual(["A-AAA", "ACAAA"]);
  });

  it("uses a deterministic center-star layout and preserves internal insertions across three rows", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-center-"));
    const source = join(root, "raw.fasta");
    writeFileSync(source, ">a\nAAAA\n>b\nACAAA\n>c\nAAGAA\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: source }, context(session, root));
    const aligned = await service.execute("sequence.align", { sessionId: opened.viewerSessionId, algorithm: "builtin-center-star" }, context(session, root));
    const metrics = aligned.result as Record<string, unknown>;
    const provenance = metrics.provenance as Record<string, unknown>;
    expect(provenance.engine).toBe("center-star/needleman-wunsch");
    expect(metrics.alignedLength).toBeGreaterThanOrEqual(5);
    const artifacts = await service.execute("sequence.query_viewer", { sessionId: opened.viewerSessionId, target: "artifacts" }, context(session, root));
    const records = ((artifacts.artifacts as Array<Record<string, unknown>>)[0]!.records as Array<{ id: string; sequence: string }>);
    expect(records.every((record) => record.sequence.length === records[0]!.sequence.length)).toBe(true);
    expect(records.some((record) => record.sequence.includes("-"))).toBe(true);
  });

  it("parses GFF3, BED, VCF, and SAM tracks into typed summaries", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-tracks-"));
    const fasta = join(root, "reference.fa");
    writeFileSync(fasta, ">chr1\nACGTACGT\n", "utf8");
    const gff = join(root, "features.gff3");
    const bed = join(root, "regions.bed");
    const vcf = join(root, "calls.vcf");
    const sam = join(root, "reads.sam");
    writeFileSync(gff, "##gff-version 3\nchr1\tfixture\tgene\t2\t6\t.\t+\t.\tID=g1;Name=Gene1\n", "utf8");
    writeFileSync(bed, "chr1\t0\t4\tregion1\t100\t+\n", "utf8");
    writeFileSync(vcf, "##fileformat=VCFv4.3\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tsample\nchr1\t3\trs1\tG\tGA\t50\tPASS\tDP=10\tGT\t0/1\n", "utf8");
    writeFileSync(sam, "@HD\tVN:1.6\nread1\t0\tchr1\t1\t60\t4M\t*\t0\t0\tACGT\tIIII\nread2\t4\t*\t0\t0\t*\t*\t0\t0\tNNNN\t!!!!\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: fasta }, context(session, root));
    const load = async (path: string, format: string) => service.execute("sequence.load_track", { sessionId: opened.viewerSessionId, path, format }, context(session, root));
    expect((((await load(gff, "gff3")).track as Record<string, unknown>).summary as Record<string, unknown>).featureCount).toBe(1);
    expect((((await load(bed, "bed")).track as Record<string, unknown>).summary as Record<string, unknown>).totalBases).toBe(4);
    expect((((await load(vcf, "vcf")).track as Record<string, unknown>).summary as Record<string, unknown>).kindCounts).toMatchObject({ insertion: 1 });
    expect((((await load(sam, "sam")).track as Record<string, unknown>).summary as Record<string, unknown>)).toMatchObject({ readCount: 2, mappedReadCount: 1, unmappedReadCount: 1 });
  });

  it("requires an index for BAM and returns a precise non-parser diagnostic even when it exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-bam-"));
    const fasta = join(root, "reference.fa"); const bam = join(root, "reads.bam"); const index = join(root, "reads.bam.bai");
    writeFileSync(fasta, ">chr1\nACGT\n", "utf8"); writeFileSync(bam, "not-a-bam", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: fasta }, context(session, root));
    await expect(service.execute("sequence.load_track", { sessionId: opened.viewerSessionId, path: bam, format: "bam" }, context(session, root))).rejects.toThrow("BAM_INDEX_REQUIRED");
    writeFileSync(index, "index", "utf8");
    await expect(service.execute("sequence.load_track", { sessionId: opened.viewerSessionId, path: bam, format: "bam", indexPath: index }, context(session, root))).rejects.toThrow("BAM_BINARY_DECODER_UNAVAILABLE");
  });

  it("rejects unknown viewer actions instead of treating them as successful state updates", async () => {
    const root = mkdtempSync(join(tmpdir(), "dsh-rosalind-sequence-control-"));
    const source = join(root, "one.fasta"); writeFileSync(source, ">one\nACGT\n", "utf8");
    const service = new SequenceService(); const session = {};
    const opened = await service.execute("sequence.open_from_chat", { path: source }, context(session, root));
    await expect(service.execute("sequence.control_viewer", { sessionId: opened.viewerSessionId, action: "invent_action" }, context(session, root))).rejects.toThrow("Unsupported Sequence Viewer control action");
  });
});

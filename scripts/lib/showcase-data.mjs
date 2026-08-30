import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const SOURCE_COMMIT = "f8c2ea83ac3b3b9258b160b80039dc3db37d76c4";
export const SOURCE_REPOSITORY = "reviewed-science-showcase-snapshot";

const PLUGIN_CATEGORIES = Object.freeze({
  "life-sciences-literature": "literature",
  "life-sciences-databases": "databases",
  "biological-sequence-viewer": "sequence",
  "ngs-analysis-workbench": "ngs",
  "molecular-structure-viewer": "structure",
  "slide-viewer": "slide",
  "rosalind-workbench": "workbench",
});

const PROVIDERS = Object.freeze({
  literature: ["ncbi-entrez", "ncbi-pmc", "biorxiv"],
  databases: ["opentargets", "ensembl", "clinvar-variation", "gwas-catalog", "gtex-eqtl", "uniprot", "chembl", "rcsb-pdb", "reactome"],
  sequence: ["local-sequence"],
  ngs: ["local-ngs", "local-container", "ssh-hpc"],
  structure: ["local-structure", "rcsb-pdb"],
  slide: ["local-slide", "public-dataset"],
  workbench: ["local-workbench"],
});

const SHOWCASE_PROVIDERS = Object.freeze({
  "literature-trem2-landscape": ["ncbi-entrez", "biorxiv"],
  "literature-pmc-availability": ["ncbi-pmc"],
  "literature-preprint-publication-link": ["biorxiv", "ncbi-entrez"],
  "databases-il6r-asthma": ["opentargets", "gwas-catalog", "gtex-eqtl"],
  "databases-variant-interpretation": ["clinvar-variation", "ensembl", "ukb-topmed-phewas", "gnomad-graphql"],
  "databases-egfr-landscape": ["uniprot", "chembl", "rcsb-pdb", "reactome"],
});

const ADAPTERS = Object.freeze({
  literature: "literature-evidence",
  databases: "database-evidence",
  sequence: "sequence-analysis",
  ngs: "ngs-workflow",
  structure: "molecular-structure",
  slide: "pathology-spatial",
  workbench: "workbench-launcher",
});

const REQUIRED_OPERATIONS = Object.freeze({
  "literature-trem2-landscape": ["literature.entrez.request"],
  "literature-pmc-availability": ["literature.pmc.request"],
  "literature-preprint-publication-link": ["literature.biorxiv.request"],
  "databases-il6r-asthma": ["databases.database.request"],
  "databases-variant-interpretation": ["databases.database.request"],
  "databases-egfr-landscape": ["databases.database.request"],
  "sequence-lambda-annotation": ["sequence.open_from_chat", "sequence.run_analysis", "sequence.query_viewer"],
  "sequence-ras-alignment": ["sequence.open_from_chat", "sequence.run_analysis", "sequence.query_viewer"],
  "sequence-fastq-qc": ["sequence.open_from_chat", "sequence.run_analysis", "sequence.query_viewer"],
  "ngs-fastq-qc": ["list_workflows", "get_runtime_environment", "check_nextflow_readiness", "plan_nextflow"],
  "ngs-bulk-rnaseq": ["list_workflows", "get_runtime_environment", "check_nextflow_readiness", "plan_nextflow"],
  "ngs-single-cell": ["list_workflows", "get_runtime_environment", "check_nextflow_readiness", "plan_nextflow"],
  "structure-mdm2-p53": ["structure.open_from_chat", "structure.set_selection", "structure.analyze", "structure.get_state"],
  "structure-adenylate-kinase": ["structure.open_from_chat", "structure.add_structure", "structure.align_structures", "structure.get_state"],
  "structure-gfp-figure": ["structure.open_from_chat", "structure.control_viewer", "structure.analyze", "structure.validate_render", "structure.render_image"],
  "slide-tissue-architecture": ["slide.open_from_chat", "slide.get_viewer_state", "slide.query_viewer"],
  "slide-spatial-expression": ["slide.import_scientific_layer", "slide.spatial_indexed", "slide.query_viewer"],
  "slide-segmentation-overlay": ["slide.import_scientific_layer", "slide.list_scientific_layers", "slide.query_viewer"],
  "slide-research-export": ["slide.import_scientific_layer", "slide.spatial_indexed", "slide.query_viewer"],
  "rosalind-molecular-design": ["rosalind.open"],
  "rosalind-structure-analysis": ["rosalind.open", "structure.open_from_chat"],
  "rosalind-genomics": ["rosalind.open", "list_workflows"],
  "rosalind-scientific-compute": ["rosalind.open", "list_compute_targets"],
});

const REQUIRED_SKILLS = Object.freeze({
  "literature-trem2-landscape": ["rosalind-literature-ncbi-entrez", "rosalind-literature-biorxiv"],
  "literature-pmc-availability": ["rosalind-literature-ncbi-pmc"],
  "literature-preprint-publication-link": ["rosalind-literature-biorxiv", "rosalind-literature-ncbi-entrez"],
  "databases-il6r-asthma": ["rosalind-databases-opentargets", "rosalind-databases-gwas-catalog", "rosalind-databases-gtex-eqtl"],
  "databases-variant-interpretation": ["rosalind-databases-clinvar-variation", "rosalind-databases-ensembl", "rosalind-databases-ukb-topmed-phewas", "rosalind-databases-gnomad-graphql"],
  "databases-egfr-landscape": ["rosalind-databases-uniprot", "rosalind-databases-chembl", "rosalind-databases-rcsb-pdb", "rosalind-databases-reactome"],
});

function requiredSkills(showcase, categoryId) {
  if (REQUIRED_SKILLS[showcase.id]) return REQUIRED_SKILLS[showcase.id];
  if (categoryId === "sequence") return ["rosalind-sequence-biological-sequence-viewer"];
  if (categoryId === "ngs") return ["rosalind-ngs-ngs-analysis-workbench", "rosalind-ngs-run-ngs-analysis"];
  if (categoryId === "structure") return ["rosalind-structure-structure-viewer"];
  if (categoryId === "slide") return ["rosalind-slide-slide-viewer"];
  if (categoryId === "workbench") return [];
  return [];
}

function requiredService(categoryId) {
  if (categoryId === "workbench") return "rosalind";
  return categoryId;
}

const MIME_TYPES = Object.freeze({
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".txt": "text/plain",
  ".py": "text/x-python",
  ".nf": "text/x-nextflow",
  ".sh": "text/x-shellscript",
  ".fastq": "text/x-fastq",
  ".diff": "text/x-diff",
  ".psf": "text/plain",
  ".jsonl": "application/x-ndjson",
  ".gff3": "text/x-gff3",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pdb": "chemical/x-pdb",
  ".cif": "chemical/x-mmcif",
  ".fasta": "text/x-fasta",
  ".aln-fasta": "text/x-fasta",
  ".gb": "text/x-genbank",
  ".nwk": "text/x-newick",
  ".md": "text/markdown",
});

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function mediaTypeFor(filePath) {
  const lower = filePath.toLowerCase();
  const extension = lower.endsWith(".aln-fasta") ? ".aln-fasta" : path.extname(lower);
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function usesCanonicalTextBytes(mediaType) {
  return mediaType.startsWith("text/")
    || mediaType === "application/json"
    || mediaType === "application/geo+json"
    || mediaType === "image/svg+xml"
    || mediaType.startsWith("chemical/");
}

export function canonicalArtifactBuffer(mediaType, buffer) {
  if (!usesCanonicalTextBytes(mediaType)) return buffer;
  return Buffer.from(buffer.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}

async function canonicalArtifactSize(filePath, mediaType) {
  return canonicalArtifactBuffer(mediaType, await readFile(filePath)).length;
}

function cleanMarkdown(value) {
  return value
    .replace(/^!\[[^\]]*\]\([^)]*\)\s*$/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function markdownSections(markdown) {
  const sections = new Map();
  const expression = /^##\s+(.+?)\s*$([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm;
  for (const match of markdown.matchAll(expression)) {
    sections.set(match[1].trim().toLowerCase(), cleanMarkdown(match[2]));
  }
  return sections;
}

function firstSection(sections, headings) {
  for (const heading of headings) {
    const value = sections.get(heading);
    if (value) return value;
  }
  return "";
}

function splitStatements(value) {
  if (!value) return [];
  return value
    .split(/(?<=\.)\s+(?=[A-Z0-9`])|\s+[-*]\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function recipeFor(showcase, categoryId, artifacts) {
  const inputs = artifacts.filter((artifact) => artifact.role === "input").map((artifact) => artifact.path);
  const outputs = artifacts.filter((artifact) => ["output", "preview", "provenance"].includes(artifact.role)).map((artifact) => artifact.path);
  let strategy = ["sequence", "structure"].includes(categoryId) ? "local" : "network";
  let providerIds = [...(SHOWCASE_PROVIDERS[showcase.id] ?? PROVIDERS[categoryId])];
  let adapter = ADAPTERS[categoryId];

  if (categoryId === "ngs") strategy = "conditional";
  if (categoryId === "slide") strategy = "conditional";
  if (showcase.id === "rosalind-molecular-design") {
    strategy = "conditional";
    adapter = "nanobody-design";
    providerIds = ["local-replay", "boltz", "biohub-esm", "modal", "runpod"];
  } else if (categoryId === "workbench") {
    strategy = "local";
    providerIds = ["local-workbench"];
  }

  return {
    adapter,
    providerIds,
    strategy,
    requiredInputs: inputs,
    expectedOutputs: outputs,
    checks: [
      "Verify every referenced artifact before presenting a scientific claim.",
      "Keep source observations, computed results, interpretation, and limitations separate.",
      "Record the chosen provider and never switch providers without user approval.",
    ],
  };
}

async function artifactRef(repositoryRoot, caseRelativePath, entry, role, runDate) {
  const relativePath = entry.repository_path
    ? toPosix(entry.repository_path)
    : toPosix(path.join(caseRelativePath, entry.path));
  const absolutePath = path.join(repositoryRoot, relativePath);
  const mediaType = mediaTypeFor(relativePath);
  const buffer = canonicalArtifactBuffer(mediaType, await readFile(absolutePath));
  const actualSha256 = sha256(buffer);
  const recordedMetadataDiffers = (entry.bytes !== undefined && entry.bytes !== buffer.length)
    || (entry.sha256 !== undefined && entry.sha256 !== actualSha256);
  const finalRole = /provenance/i.test(entry.path) ? "provenance" : role;
  const resourceUri = mediaType === "image/svg+xml"
    ? `data:image/svg+xml;base64,${buffer.toString("base64")}`
    : role === "preview"
      ? `dsh-rosalind://${relativePath}`
      : undefined;
  return {
    id: entry.id ?? `${caseRelativePath.split("/").at(-1)}:${entry.path}`,
    role: finalRole,
    mediaType,
    source: entry.source ?? (recordedMetadataDiffers
      ? `Pinned file identity supersedes stale source-manifest metadata (recorded bytes=${entry.bytes ?? "unspecified"}, sha256=${entry.sha256 ?? "unspecified"}).`
      : undefined),
    generatedAt: ["output", "preview", "provenance"].includes(finalRole) ? runDate : undefined,
    path: relativePath,
    resourceUri,
    bytes: buffer.length,
    sha256: entry.sha256 === undefined ? undefined : actualSha256,
  };
}

async function readCatalog(repositoryRoot) {
  const catalogPath = path.join(repositoryRoot, "showcases", "catalog.json");
  return JSON.parse(await readFile(catalogPath, "utf8"));
}

export async function buildCatalogue(repositoryRoot) {
  const catalog = await readCatalog(repositoryRoot);
  const definitions = [];

  for (const plugin of catalog.plugins) {
    const categoryId = PLUGIN_CATEGORIES[plugin.id];
    if (!categoryId) throw new Error(`No category mapping exists for plugin ${plugin.id}`);
    for (const summary of plugin.showcases) {
      const caseRelativePath = toPosix(summary.case_path);
      const caseDirectory = path.join(repositoryRoot, caseRelativePath);
      const manifest = JSON.parse(await readFile(path.join(caseDirectory, "showcase.json"), "utf8"));
      const readme = await readFile(path.join(caseDirectory, "README.md"), "utf8");
      const sections = markdownSections(readme);
      const artifacts = [];
      const seen = new Set();
      const addEntries = async (entries, role) => {
        for (const entry of entries ?? []) {
          const artifactPath = entry.repository_path ?? entry.path;
          if (seen.has(artifactPath)) continue;
          seen.add(artifactPath);
          artifacts.push(await artifactRef(repositoryRoot, caseRelativePath, entry, entry.role ?? role, manifest.run_date));
        }
      };
      await addEntries(manifest.inputs, "input");
      await addEntries(manifest.previews, "preview");
      await addEntries(manifest.outputs, "output");
      await addEntries(manifest.dependencies?.artifacts, "input");
      for (const record of manifest.provenance ?? []) {
        await addEntries((record.inputs ?? []).map((entry) => typeof entry === "string" ? { path: entry } : entry), "provenance");
        await addEntries((record.outputs ?? []).map((entry) => typeof entry === "string" ? { path: entry } : entry), "provenance");
        await addEntries((record.previews ?? []).map((entry) => typeof entry === "string" ? { path: entry } : entry), "provenance");
      }

      const readmePath = `${caseRelativePath}/README.md`;
      const promptPath = `${caseRelativePath}/${manifest.prompt}`;
      artifacts.unshift(
        { id: `${manifest.id}:README.md`, role: "input", mediaType: "text/markdown", path: readmePath, bytes: await canonicalArtifactSize(path.join(repositoryRoot, readmePath), "text/markdown") },
        { id: `${manifest.id}:${manifest.prompt}`, role: "input", mediaType: "text/markdown", path: promptPath, bytes: await canonicalArtifactSize(path.join(repositoryRoot, promptPath), "text/markdown") },
      );

      const sourceSection = firstSection(sections, ["source observations", "verified observations", "source and method", "observed interface state", "rosalind observation"]);
      const computedSection = firstSection(sections, ["computed results", "computed result", "viewer analysis", "result", "computed summary", "starter-contract metric", "alignment result carried by the starter contract"]);
      const dependencySources = manifest.dependencies?.provenance?.sources ?? [];
      const sources = unique([...(manifest.sources ?? []), ...dependencySources]);
      const sourceObservations = unique(
        sourceSection
          ? splitStatements(sourceSection)
          : manifest.observations ?? [],
      );
      const computedResults = unique(
        Array.isArray(manifest.computed_results) && manifest.computed_results.length
          ? manifest.computed_results
          : splitStatements(computedSection),
      );
      const interpretation = unique(manifest.interpretation ?? splitStatements(firstSection(sections, ["interpretation", "scientific interpretation"])));
      const limitations = unique(manifest.limitations ?? splitStatements(firstSection(sections, ["limitations", "limitation"])));
      const inputArtifactIds = artifacts.filter((item) => ["input", "provenance"].includes(item.role)).map((item) => item.id);
      const outputArtifactIds = artifacts.filter((item) => ["output", "preview", "provenance"].includes(item.role)).map((item) => item.id);
      const claims = [
        ...sourceObservations.map((statement, index) => ({ id: `${manifest.id}:observation:${index + 1}`, statement, kind: "observation", artifactIds: inputArtifactIds })),
        ...computedResults.map((statement, index) => ({ id: `${manifest.id}:computed:${index + 1}`, statement, kind: "computed", artifactIds: outputArtifactIds })),
        ...interpretation.map((statement, index) => ({ id: `${manifest.id}:interpretation:${index + 1}`, statement, kind: "interpretation", artifactIds: outputArtifactIds })),
      ];
      const previewPath = manifest.previews?.[0]?.path;
      const preview = previewPath
        ? artifacts.find((item) => item.path === `${caseRelativePath}/${previewPath}`) ?? null
        : null;
      const question = firstSection(sections, ["scientific question", "scientific objective", "proposed analysis"]) || summary.summary;

      definitions.push({
        id: manifest.id,
        pluginId: manifest.plugin_id,
        pluginVersion: manifest.plugin_version,
        categoryId,
        domain: manifest.domain,
        caseType: manifest.case_type,
        difficulty: manifest.difficulty,
        evidenceLevel: manifest.evidence_level,
        capabilities: unique(manifest.capabilities ?? []),
        rosalindTasks: unique(manifest.rosalind_tasks ?? []),
        execution: {
          actualTools: unique(manifest.execution?.actual_tools ?? []),
          device: manifest.execution?.device ?? "not recorded",
          implementation: manifest.execution?.implementation ?? "not recorded",
          status: manifest.execution?.status ?? "not recorded",
        },
        title: summary.title,
        summary: summary.summary,
        question,
        status: manifest.status,
        runDate: manifest.run_date,
        readmePath,
        promptPath,
        preview,
        artifacts,
        sources,
        observations: sourceObservations,
        computedResults,
        interpretation,
        limitations,
        claims,
        requiredMcpServers: unique(manifest.dependencies?.required_mcp_servers ?? [requiredService(categoryId)]),
        requiredOperations: unique(manifest.dependencies?.required_operations ?? REQUIRED_OPERATIONS[manifest.id] ?? manifest.capabilities ?? []),
        requiredSkills: unique(manifest.dependencies?.required_skills ?? requiredSkills(manifest, categoryId)),
        fixtures: artifacts.filter((item) => item.role === "input").map((item) => item.id),
        expectedArtifacts: artifacts.filter((item) => ["output", "preview", "provenance"].includes(item.role)).map((item) => item.id),
        scientificAssertions: claims.filter((claim) => claim.kind !== "interpretation"),
        visualAssertions: preview ? [{ id: `${manifest.id}:preview`, artifactId: preview.id, requirement: "The preview opens at its native aspect ratio in light and dark Workbench themes." }] : [],
        provenance: { sourceCommit: SOURCE_COMMIT, sources, runDate: manifest.run_date, records: manifest.provenance ?? [] },
        reproductionSteps: unique(manifest.reproduction ?? []),
        recipe: recipeFor(manifest, categoryId, artifacts),
        modes: ["lesson", "replay", "reproduce"],
        searchText: unique([summary.title, summary.summary, question, categoryId, plugin.name, ...(manifest.sources ?? [])]).join(" ").toLowerCase(),
      });
    }
  }
  return definitions;
}

export async function caseFiles(repositoryRoot) {
  const root = path.join(repositoryRoot, "showcases");
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name !== ".gitkeep" && (absolute.includes(`${path.sep}cases${path.sep}`) || entry.name === "catalog.json")) files.push(absolute);
    }
  }
  await walk(root);
  return files.sort();
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("CSV ends inside a quoted field");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const width = rows[0]?.length ?? 0;
  if (!width || rows.some((candidate) => candidate.length !== width)) throw new Error("CSV rows have inconsistent field counts");
  return rows;
}

export function parseFasta(text) {
  const records = [];
  let current;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith(">")) { current = { id: line.slice(1).trim(), sequence: "" }; records.push(current); }
    else if (line.trim()) {
      if (!current) throw new Error("FASTA sequence appears before the first header");
      current.sequence += line.trim();
    }
  }
  if (!records.length || records.some((record) => !record.id || !record.sequence || !/^[A-Za-z*?\-.]+$/.test(record.sequence))) throw new Error("Invalid FASTA content");
  return records;
}

export function validateFileBuffer(relativePath, buffer) {
  const mediaType = mediaTypeFor(relativePath);
  const text = mediaType.startsWith("text/") || mediaType.includes("json") || mediaType.includes("svg") || mediaType.includes("chemical")
    ? buffer.toString("utf8") : "";
  if (!buffer.length) throw new Error(`${relativePath}: empty file`);
  if (mediaType === "application/json" || mediaType === "application/geo+json") JSON.parse(text);
  else if (mediaType === "text/csv") parseCsv(text);
  else if (mediaType === "image/svg+xml" && (!/<svg\b/.test(text) || !/<\/svg>/.test(text))) throw new Error(`${relativePath}: malformed SVG`);
  else if (mediaType === "image/png" && !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`${relativePath}: invalid PNG signature`);
  else if (mediaType === "chemical/x-pdb" && !/^((ATOM  )|(HETATM))/m.test(text)) throw new Error(`${relativePath}: no PDB atom records`);
  else if (mediaType === "chemical/x-mmcif" && (!/^data_/m.test(text) || !/_(?:atom_site|refln)\./.test(text))) throw new Error(`${relativePath}: missing mmCIF atom or reflection table`);
  else if (mediaType === "text/x-fasta") parseFasta(text);
  else if (mediaType === "text/x-genbank" && (!/^LOCUS\s/m.test(text) || !/^ORIGIN\s*$/m.test(text) || !/^\/\/$/m.test(text))) throw new Error(`${relativePath}: malformed GenBank record`);
  else if (mediaType === "text/x-newick") {
    const trimmed = text.trim();
    let depth = 0;
    for (const character of trimmed) { if (character === "(") depth += 1; if (character === ")") depth -= 1; if (depth < 0) break; }
    if (!trimmed.endsWith(";") || depth !== 0) throw new Error(`${relativePath}: malformed Newick tree`);
  } else if (mediaType === "text/markdown" && !text.trim()) throw new Error(`${relativePath}: empty Markdown`);
  return mediaType;
}

export async function scientificAcceptance(repositoryRoot) {
  const readJson = async (relativePath) => JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
  const lambda = await readJson("showcases/biological-sequence-viewer/cases/sequence-lambda-annotation/outputs/analysis.json");
  const rasRecords = parseFasta(await readFile(path.join(repositoryRoot, "showcases/biological-sequence-viewer/cases/sequence-ras-alignment/inputs/human-RAS-UniProt-SV1.aln-fasta"), "utf8"));
  const alignedLength = rasRecords[0].sequence.length;
  let columnIdentity = 0;
  for (let column = 0; column < alignedLength; column += 1) {
    const residues = rasRecords.map((record) => record.sequence[column]).filter((residue) => residue !== "-");
    const counts = new Map();
    for (const residue of residues) counts.set(residue, (counts.get(residue) ?? 0) + 1);
    columnIdentity += Math.max(...counts.values()) / residues.length;
  }
  const ras = await readJson("showcases/biological-sequence-viewer/cases/sequence-ras-alignment/outputs/analysis.json");
  const fastq = await readJson("showcases/biological-sequence-viewer/cases/sequence-fastq-qc/outputs/quality-summary.json");
  const mdm2 = await readJson("showcases/molecular-structure-viewer/cases/structure-mdm2-p53/outputs/results.json");
  const gfp = await readJson("showcases/molecular-structure-viewer/cases/structure-gfp-figure/showcase.json");
  const slide = await readJson("showcases/slide-viewer/cases/slide-tissue-architecture/outputs/pyramid-metadata.json");
  const spatial = await readJson("showcases/slide-viewer/cases/slide-spatial-expression/outputs/metadata-summary.json");
  const exportRows = parseCsv(await readFile(path.join(repositoryRoot, "showcases/slide-viewer/cases/slide-research-export/outputs/spatial-observations-expression.csv"), "utf8"));
  const design = await readJson("showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/result-summary.json");
  const candidateRows = parseCsv(await readFile(path.join(repositoryRoot, "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/candidates.csv"), "utf8"));
  const rankingRows = parseCsv(await readFile(path.join(repositoryRoot, "showcases/rosalind-workbench/cases/rosalind-molecular-design/outputs/top5_ensemble_ranking.csv"), "utf8"));
  const gfpText = gfp.observations.join(" ");

  return {
    lambda: { codingBases: lambda.cI_coding_bases, residues: lambda.translated_residues, translationMatches: lambda.matches_genbank_translation },
    ras: { rows: rasRecords.length, alignedLength, meanIdentity: columnIdentity / alignedLength, distances: ras.distance.matrix, newick: ras.tree.newick },
    fastq: { reads: fastq.records, bases: fastq.bases, q30Percent: fastq.q30_percent },
    mdm2: { atomContacts: mdm2.computed_from_pinned_pdb.atom_contact_count, residuePairs: mdm2.computed_from_pinned_pdb.residue_pair_count },
    gfp: {
      residues: Number(gfpText.match(/(\d+) protein residues/)?.[1]),
      atoms: Number(gfpText.match(/(\d+) atoms/)?.[1]),
      contactResidues: Number(gfpText.match(/(\d+) polymer residues within 4\.0/)?.[1]),
    },
    slide: { width: slide.main_image.width, height: slide.main_image.height },
    spatial: { observations: spatial.observations, genes: spatial.genes, exportedRows: exportRows.length - 1 },
    pdl1: {
      candidates: candidateRows.length - 1,
      topFiveRows: rankingRows.length - 1,
      ensemblePredictions: design.top5_ensemble_predictions_successful,
      firstCandidate: rankingRows[1][1],
    },
  };
}

export async function validateShowcases(repositoryRoot) {
  const catalog = await readCatalog(repositoryRoot);
  const definitions = await buildCatalogue(repositoryRoot);
  const files = await caseFiles(repositoryRoot);
  const errors = [];
  const parsedByType = {};

  if (catalog.plugins.length !== 7) errors.push(`Expected 7 plugins, found ${catalog.plugins.length}`);
  if (definitions.length !== 100) errors.push(`Expected 100 showcases, found ${definitions.length}`);
  if (definitions.some((item) => item.status !== "ready")) errors.push("All 100 release showcases must be ready");
  if (new Set(definitions.map((item) => item.id)).size !== definitions.length) errors.push("Showcase IDs must be unique");
  if (files.length !== 1224) errors.push(`Expected 1224 committed catalogue/case files, found ${files.length}`);

  for (const absolutePath of files) {
    const relativePath = toPosix(path.relative(repositoryRoot, absolutePath));
    try {
      const mediaType = validateFileBuffer(relativePath, await readFile(absolutePath));
      parsedByType[mediaType] = (parsedByType[mediaType] ?? 0) + 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const notice = await readFile(path.join(repositoryRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  if (!notice.includes(SOURCE_COMMIT)) errors.push("THIRD_PARTY_NOTICES.md does not identify the pinned source commit");

  const acceptance = await scientificAcceptance(repositoryRoot);
  const exactChecks = [
    [acceptance.lambda.codingBases === 714, "Lambda coding interval must be 714 nt"],
    [acceptance.lambda.residues === 237 && acceptance.lambda.translationMatches, "Lambda translation must be 237 aa and match GenBank"],
    [acceptance.ras.rows === 3 && acceptance.ras.alignedLength === 191, "RAS alignment must be 3 by 191"],
    [acceptance.ras.meanIdentity === 0.9284467713787081, "RAS mean identity differs from the accepted value"],
    [JSON.stringify(acceptance.ras.distances) === JSON.stringify([[0,0.13157894736842105,0.1368421052631579],[0.13157894736842105,0,0.15789473684210525],[0.1368421052631579,0.15789473684210525,0]]), "RAS distance matrix differs from the accepted matrix"],
    [acceptance.ras.newick === "('P01116':0.027632,('P01111':0.076316,'P01112':0.081579):0.027632);", "RAS NJ tree differs from the accepted tree"],
    [acceptance.fastq.reads === 500 && acceptance.fastq.bases === 235490 && acceptance.fastq.q30Percent === 95.39768143020935, "FASTQ acceptance metrics differ"],
    [acceptance.mdm2.atomContacts === 105 && acceptance.mdm2.residuePairs === 34, "MDM2-p53 contact metrics differ"],
    [acceptance.gfp.residues === 225 && acceptance.gfp.atoms === 1866 && acceptance.gfp.contactResidues === 18, "GFP acceptance metrics differ"],
    [acceptance.slide.width === 46000 && acceptance.slide.height === 32893, "Slide dimensions differ"],
    [acceptance.spatial.observations === 684 && acceptance.spatial.genes === 18078 && acceptance.spatial.exportedRows === 684, "Spatial acceptance metrics differ"],
    [acceptance.pdl1.candidates === 20 && acceptance.pdl1.topFiveRows === 5 && acceptance.pdl1.ensemblePredictions === 25 && acceptance.pdl1.firstCandidate === "NB13_E104Q", "PD-L1 acceptance metrics differ"],
  ];
  errors.push(...exactChecks.filter(([passed]) => !passed).map(([, message]) => message));
  return { ok: errors.length === 0, errors, pluginCount: catalog.plugins.length, showcaseCount: definitions.length, fileCount: files.length, parsedByType, acceptance };
}

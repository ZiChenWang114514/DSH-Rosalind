import type { ShowcaseCategory } from "./types.js";

export const SHOWCASE_CATEGORIES: ShowcaseCategory[] = [
  { id: "literature", label: "Literature", shortLabel: "Papers", description: "Publication discovery, access, and version linkage", color: "#a36f4c", icon: "literature" },
  { id: "databases", label: "Databases", shortLabel: "Evidence", description: "Genetics, target, pathway, structure, and pharmacology evidence", color: "#667bb3", icon: "database" },
  { id: "sequence", label: "Sequences", shortLabel: "Sequence", description: "Annotation, alignment, phylogeny, and read quality", color: "#4e8b79", icon: "sequence" },
  { id: "ngs", label: "NGS", shortLabel: "NGS", description: "Assay-aware workflow planning and compute readiness", color: "#8069a8", icon: "ngs" },
  { id: "structure", label: "Structures", shortLabel: "3D", description: "Molecular contacts, alignment, surfaces, and figures", color: "#b66c65", icon: "structure" },
  { id: "slide", label: "Pathology & Spatial", shortLabel: "Spatial", description: "Whole-slide imagery, expression, annotations, and exports", color: "#b18b3e", icon: "slide" },
  { id: "workbench", label: "Workbench", shortLabel: "Design", description: "Molecular design and guided scientific launchers", color: "#477c9f", icon: "workbench" },
];

export const categoryById = new Map(SHOWCASE_CATEGORIES.map((category) => [category.id, category]));

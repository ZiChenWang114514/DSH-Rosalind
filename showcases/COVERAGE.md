# Science showcase coverage

- Scientific operations: **35/117**
- Rosalind official tasks: **12/12**

## Operation groups

| Group | Version | Covered |
| --- | --- | ---: |
| rosalind | 0.2.2-research-preview | 1/1 |
| ngs-analysis-workbench | 0.2.16 | 12/19 |
| ngs-compute | current installed contract | 3/3 |
| sequence-viewer | 0.1.43 | 5/13 |
| structure-viewer | 0.1.80 | 12/41 |
| slide-viewer | 0.1.56 | 2/40 |

## Rosalind official tasks

| Task | Covered by |
| --- | --- |
| `design-pdl1-nanobodies` | `rosalind-molecular-design` |
| `improve-trastuzumab-cdrs` | `rosalind-trastuzumab-cdr` |
| `dock-imatinib-abl1` | `rosalind-imatinib-abl1` |
| `design-jak2-binders` | `rosalind-jak2-selectivity` |
| `predict-ace-inhibitor-logd-pka` | `rosalind-ace-logd-pka` |
| `assess-antibody-developability` | `rosalind-antibody-developability` |
| `predict-kras-g12c` | `rosalind-structure-analysis` |
| `map-petase-mutations` | `rosalind-petase-mutations` |
| `analyze-airway-rnaseq` | `rosalind-genomics` |
| `compare-pathology-visium` | `rosalind-breast-visium` |
| `embed-gb1-sequences` | `rosalind-scientific-compute` |
| `price-pdl1-assays` | `rosalind-pdl1-assay-plan` |

## Operation details

### rosalind

| Operation | Covered by |
| --- | --- |
| `rosalind.rosalind_open` | `databases-airway-rnaseq`, `databases-egfr-landscape`, `databases-il6r-asthma`, `databases-kras-g12c`, `databases-pdl1`, `databases-petase`, `databases-variant-interpretation`, `literature-kras-g12c`, `literature-nanobody-assays`, `literature-pmc-availability`, `literature-preprint-publication-link`, `literature-trem2-landscape`, `literature-visium-methods`, `ngs-bulk-rnaseq`, `ngs-compute-inventory`, `ngs-fastq-qc`, `ngs-nextflow-readiness`, `ngs-run-cancellation`, `ngs-run-execution`, `ngs-run-observation`, `ngs-run-summary`, `ngs-runtime-inspection`, `ngs-single-cell`, `ngs-snakemake-readiness`, `ngs-ssh-target`, `ngs-workflow-archive`, `ngs-workflow-save`, `ngs-workflow-versions`, `rosalind-ace-logd-pka`, `rosalind-adenylate-kinase`, `rosalind-antibody-breadth`, `rosalind-antibody-developability`, `rosalind-boltz-repeats`, `rosalind-breast-visium`, `rosalind-cross-tool-export`, `rosalind-egfr-t790m`, `rosalind-egfr-vhh`, `rosalind-fastq-qc`, `rosalind-genomics`, `rosalind-gfp-pocket`, `rosalind-il6r-vhh`, `rosalind-imatinib-abl1`, `rosalind-jak2-selectivity`, `rosalind-kinase-metabolism`, `rosalind-kras-g12c-ligand`, `rosalind-mdm2-p53-inhibitor`, `rosalind-molecular-design`, `rosalind-nextflow-snakemake`, `rosalind-oral-candidates`, `rosalind-pdl1-assay-plan`, `rosalind-petase-mutations`, `rosalind-ras-isoforms`, `rosalind-scientific-compute`, `rosalind-single-cell-tme`, `rosalind-structure-analysis`, `rosalind-trastuzumab-cdr`, `rosalind-variant-pathway`, `rosalind-vhh-aggregation`, `sequence-annotation-track`, `sequence-edit-copy`, `sequence-export-package`, `sequence-fastq-qc`, `sequence-guide-tree`, `sequence-job-cancel`, `sequence-lambda-annotation`, `sequence-motif-search`, `sequence-public-example`, `sequence-ras-alignment`, `sequence-row-groups`, `sequence-session-restore`, `slide-authorization-renewal`, `slide-dicom-export`, `slide-dicomweb`, `slide-local-dicom`, `slide-ome-tiff`, `slide-ome-zarr`, `slide-pathology-workflow`, `slide-research-export`, `slide-roi-measurement`, `slide-scientific-layers`, `slide-segmentation-overlay`, `slide-spatial-expression`, `slide-spatial-research-package`, `slide-tissue-architecture`, `slide-workflow-recovery`, `structure-adenylate-kinase`, `structure-assembly-symmetry`, `structure-clash-screen`, `structure-density-map`, `structure-dna-hydrogen-bonds`, `structure-gfp-figure`, `structure-heme-contacts`, `structure-ligand-pocket`, `structure-mdm2-p53`, `structure-motif-search`, `structure-quality-assessment`, `structure-residue-selection`, `structure-rmsd-alignment`, `structure-scene-storyboard`, `structure-trajectory-movie` |

### ngs-analysis-workbench

| Operation | Covered by |
| --- | --- |
| `ngs-analysis-workbench.activate_workflow_version` | `ngs-workflow-versions` |
| `ngs-analysis-workbench.archive_workflow` | `ngs-workflow-archive` |
| `ngs-analysis-workbench.cancel_ngs_run` | — |
| `ngs-analysis-workbench.check_nextflow_readiness` | `ngs-bulk-rnaseq`, `ngs-fastq-qc`, `ngs-nextflow-readiness`, `ngs-single-cell` |
| `ngs-analysis-workbench.check_snakemake_readiness` | `ngs-snakemake-readiness` |
| `ngs-analysis-workbench.execute_plan` | — |
| `ngs-analysis-workbench.get_ngs_run` | — |
| `ngs-analysis-workbench.get_runtime_environment` | `ngs-compute-inventory`, `ngs-fastq-qc`, `ngs-nextflow-readiness`, `ngs-run-execution`, `ngs-runtime-inspection`, `ngs-snakemake-readiness` |
| `ngs-analysis-workbench.list_ngs_run_lineages` | `ngs-run-observation` |
| `ngs-analysis-workbench.list_ngs_runs` | `ngs-run-observation` |
| `ngs-analysis-workbench.list_workflow_versions` | `ngs-run-summary`, `ngs-workflow-versions` |
| `ngs-analysis-workbench.list_workflows` | `ngs-bulk-rnaseq`, `ngs-fastq-qc`, `ngs-nextflow-readiness`, `ngs-run-cancellation`, `ngs-single-cell`, `ngs-snakemake-readiness`, `ngs-workflow-archive`, `ngs-workflow-save` |
| `ngs-analysis-workbench.observe_ngs_run` | — |
| `ngs-analysis-workbench.plan_nextflow` | — |
| `ngs-analysis-workbench.plan_snakemake` | — |
| `ngs-analysis-workbench.restore_workflow` | `ngs-workflow-archive` |
| `ngs-analysis-workbench.save_workflow` | `ngs-workflow-save` |
| `ngs-analysis-workbench.update_ngs_run_analysis_summary` | — |
| `ngs-analysis-workbench.update_workflow` | `ngs-workflow-versions` |

### ngs-compute

| Operation | Covered by |
| --- | --- |
| `ngs-compute.configure_ssh_target` | `ngs-ssh-target` |
| `ngs-compute.inspect_compute_target` | `ngs-compute-inventory`, `ngs-ssh-target` |
| `ngs-compute.list_compute_targets` | `ngs-compute-inventory`, `ngs-ssh-target` |

### sequence-viewer

| Operation | Covered by |
| --- | --- |
| `sequence-viewer.sequence_acquire_public_example` | — |
| `sequence-viewer.sequence_align` | — |
| `sequence-viewer.sequence_cancel_job` | — |
| `sequence-viewer.sequence_control_viewer` | `sequence-motif-search`, `sequence-ras-alignment` |
| `sequence-viewer.sequence_edit_copy` | — |
| `sequence-viewer.sequence_export_artifact` | `sequence-guide-tree`, `sequence-ras-alignment` |
| `sequence-viewer.sequence_load_track` | — |
| `sequence-viewer.sequence_manage_annotations` | — |
| `sequence-viewer.sequence_open_from_chat` | `sequence-guide-tree`, `sequence-motif-search`, `sequence-ras-alignment` |
| `sequence-viewer.sequence_query_viewer` | `sequence-guide-tree`, `sequence-motif-search`, `sequence-ras-alignment` |
| `sequence-viewer.sequence_restore_session` | — |
| `sequence-viewer.sequence_run_analysis` | `sequence-guide-tree`, `sequence-ras-alignment` |
| `sequence-viewer.sequence_save_session` | — |

### structure-viewer

| Operation | Covered by |
| --- | --- |
| `structure-viewer.structure_add_structure` | `structure-scene-storyboard` |
| `structure-viewer.structure_align_structures` | — |
| `structure-viewer.structure_analyze` | — |
| `structure-viewer.structure_apply_scene` | — |
| `structure-viewer.structure_assembly_symmetry` | — |
| `structure-viewer.structure_browse_related_data` | — |
| `structure-viewer.structure_cancel_render` | — |
| `structure-viewer.structure_control_viewer` | `structure-mdm2-p53` |
| `structure-viewer.structure_delete_scene` | — |
| `structure-viewer.structure_derive_object` | `structure-mdm2-p53` |
| `structure-viewer.structure_discover_density` | — |
| `structure-viewer.structure_export` | — |
| `structure-viewer.structure_get_render_status` | — |
| `structure-viewer.structure_get_state` | `structure-scene-storyboard` |
| `structure-viewer.structure_list_scenes` | — |
| `structure-viewer.structure_list_structures` | — |
| `structure-viewer.structure_load_background` | — |
| `structure-viewer.structure_load_data` | — |
| `structure-viewer.structure_load_public_density` | — |
| `structure-viewer.structure_load_scene` | — |
| `structure-viewer.structure_manage_guides` | `structure-mdm2-p53` |
| `structure-viewer.structure_measure` | — |
| `structure-viewer.structure_open_from_chat` | — |
| `structure-viewer.structure_pymol_action` | `structure-mdm2-p53` |
| `structure-viewer.structure_pymol_actions` | `structure-mdm2-p53` |
| `structure-viewer.structure_quality_assessment` | — |
| `structure-viewer.structure_query` | — |
| `structure-viewer.structure_redo` | `structure-scene-storyboard` |
| `structure-viewer.structure_remove_structure` | — |
| `structure-viewer.structure_render_image` | `structure-gfp-figure` |
| `structure-viewer.structure_render_movie` | — |
| `structure-viewer.structure_save_scene` | — |
| `structure-viewer.structure_search_motif` | — |
| `structure-viewer.structure_set_assembly_symmetry` | — |
| `structure-viewer.structure_set_object_visibility` | `structure-scene-storyboard` |
| `structure-viewer.structure_set_quality_assessment` | — |
| `structure-viewer.structure_set_selection` | — |
| `structure-viewer.structure_set_trajectory_state` | — |
| `structure-viewer.structure_transform_object` | `structure-scene-storyboard` |
| `structure-viewer.structure_undo` | `structure-scene-storyboard` |
| `structure-viewer.structure_validate_render` | — |

### slide-viewer

| Operation | Covered by |
| --- | --- |
| `slide-viewer.slide_cancel_analysis_from_chat` | — |
| `slide-viewer.slide_cancel_pathology` | — |
| `slide-viewer.slide_cancel_scientific_layer_import` | — |
| `slide-viewer.slide_cancel_workflow` | — |
| `slide-viewer.slide_export_dicom_object` | — |
| `slide-viewer.slide_get_analysis_from_chat` | — |
| `slide-viewer.slide_get_capabilities` | — |
| `slide-viewer.slide_get_live_workflow` | — |
| `slide-viewer.slide_get_pathology` | — |
| `slide-viewer.slide_get_scientific_entity` | — |
| `slide-viewer.slide_get_scientific_layer_import` | — |
| `slide-viewer.slide_get_viewer_state` | — |
| `slide-viewer.slide_get_workflow` | — |
| `slide-viewer.slide_import_analysis_source_from_chat` | — |
| `slide-viewer.slide_import_dicom_object` | — |
| `slide-viewer.slide_import_scientific_layer` | `slide-scientific-layers` |
| `slide-viewer.slide_import_workflow_source` | `slide-workflow-recovery` |
| `slide-viewer.slide_inspect_dicomweb_instance` | — |
| `slide-viewer.slide_list_scientific_layers` | — |
| `slide-viewer.slide_list_workflow_sources` | — |
| `slide-viewer.slide_list_workflows` | — |
| `slide-viewer.slide_open_dicom_series` | — |
| `slide-viewer.slide_open_dicomweb_wsi` | — |
| `slide-viewer.slide_open_from_chat` | — |
| `slide-viewer.slide_open_ome_tiff_series` | — |
| `slide-viewer.slide_open_ome_zarr` | — |
| `slide-viewer.slide_prepare_dicom_upload` | — |
| `slide-viewer.slide_query_dicomweb` | — |
| `slide-viewer.slide_query_viewer` | — |
| `slide-viewer.slide_read_dicomweb_object` | — |
| `slide-viewer.slide_read_live_workflow_artifact` | — |
| `slide-viewer.slide_read_workflow_artifact` | — |
| `slide-viewer.slide_renew_scientific_layer_authorization` | — |
| `slide-viewer.slide_renew_source_authorization` | — |
| `slide-viewer.slide_resume_pathology` | — |
| `slide-viewer.slide_resume_workflow` | — |
| `slide-viewer.slide_run_workflow` | — |
| `slide-viewer.slide_spatial_indexed` | — |
| `slide-viewer.slide_submit_dicom_upload` | — |
| `slide-viewer.slide_wait_for_render` | — |

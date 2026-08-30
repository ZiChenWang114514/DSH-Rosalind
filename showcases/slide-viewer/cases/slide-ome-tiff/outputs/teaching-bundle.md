# Codex showcase lesson: OME-TIFF series import

## Session prompt

Use $showcase-teacher to import and teach the ready showcase `slide-ome-tiff` (OME-TIFF series import). Inspect its README, manifest, prompt, inputs, outputs, previews, and provenance records. Clearly distinguish source observations, computed results, scientific interpretation, and limitations, and show the preview when useful.

## Catalogue record

- Showcase ID: `slide-ome-tiff`
- Plugin: `slide-viewer` (Slide Viewer v0.1.56)
- Status: `ready`
- Summary: How are OME dimensions and TIFF members validated for a microscopy series?
- Recorded next step: Open the case README and inspect the public source, receipt, preview, interpretation, and limitations.
- Plugin guide: `showcases/slide-viewer/README.md`

## Repository files to inspect

- case guide: `showcases/slide-viewer/cases/slide-ome-tiff/README.md`
- case manifest: `showcases/slide-viewer/cases/slide-ome-tiff/showcase.json`
- teaching prompt: `showcases/slide-viewer/cases/slide-ome-tiff/prompt.md`
- input: `showcases/slide-viewer/cases/slide-ome-tiff/inputs/public-source.md`
- output: `showcases/slide-viewer/cases/slide-ome-tiff/outputs/verification-receipt.json`
- output: `showcases/slide-viewer/cases/slide-ome-tiff/outputs/rosalind-open-observation.json`
- output: `showcases/slide-viewer/cases/slide-ome-tiff/outputs/teaching-bundle.md`
- preview: `showcases/slide-viewer/cases/slide-ome-tiff/previews/preview.svg`

## Public sources

- https://downloads.openmicroscopy.org/images/OME-TIFF/2016-06/bioformats-artificial/multi-channel-z-series.ome.tif
- https://downloads.openmicroscopy.org/images/OME-TIFF/2016-06/bioformats-artificial/readme.txt
- https://ome-model.readthedocs.io/en/stable/developers/sample-files.html

## Retained case guide

# Official OME-TIFF multichannel Z-series

![OME-TIFF topology summary](previews/preview.svg)

## Scientific question

Does the official synthetic OME-TIFF contain a self-consistent C/Z/T plane map, and what did the current Slide Viewer session actually acknowledge?

## Source observations

- The publisher served the exact 1,128,003-byte TIFF under the collection's CC BY 4.0 notice.
- The downloaded file has SHA-256 `f8cebdb6036060e433576bd0303f6f632fac6f2a71f2e7ceec08a13f34f69cba`.
- Embedded OME-XML reports `XYZCT`, 439 × 167 pixels, C=3, Z=5, T=1, signed 8-bit pixels, and fifteen explicit TIFF data entries.
- `tiffinfo 4.7.1` independently reported fifteen IFDs with matching plane dimensions.

## Calculated result

`3 channels × 5 Z planes × 1 time point = 15 planes`, matching both the OME-XML mapping and TIFF directory count.

## Actual Slide Viewer check

The OME-TIFF open operation authorized a source and issued a session, but the viewer remained `awaiting-viewer` with no state revision. State, layer, and microscopy-scene queries timed out. A render wait was not possible without a state revision.

## Rosalind Workbench observation

`mcp__rosalind__rosalind_open` was genuinely invoked with the verified OME-TIFF topology context. Its exact response and timestamp are retained in `outputs/rosalind-open-observation.json`. The operation opened the Rosalind task chooser only; it did not select or execute a scientific job and supplies no scientific result for this case.

## Scientific interpretation

The file topology is internally consistent and suitable for future C/Z navigation testing. No channel, Z plane, layer, or visible image claim is made from the current session.

## Reproduce

1. Verify the HTTPS headers, byte count, and local SHA-256.
2. Extract the first TIFF ImageDescription, parse the OME-XML, and count its TIFF data entries.
3. Count TIFF directories with `tiffinfo` and compare them with C × Z × T.
4. Invoke `mcp__rosalind__rosalind_open` with the case-specific task context and retain the chooser response separately from scientific evidence.
5. Open the one explicit member. Continue to scene and render checks only if the viewer reports a current state revision.

## Retained execution prompt

# Inspect the official multichannel Z-series OME-TIFF

Download the single official CC BY 4.0 sample, verify its published byte count, compute SHA-256, parse the embedded OME-XML, and compare `SizeC × SizeZ × SizeT` with the explicit TIFF data mapping. Invoke `mcp__rosalind__rosalind_open` with a task context specific to this topology review and cite `outputs/rosalind-open-observation.json`; its chooser response does not prove scientific task execution. Open the exact member with `mcp__slide_viewer__slide_open_ome_tiff_series`. Record source authorization separately from viewer readiness, and report channel or Z changes only after an acknowledged mounted state and synchronized render.

## Teaching note

Use this bundle to locate the evidence. Read the listed repository artifacts before presenting scientific claims, and keep observations, calculations, interpretation, and limitations distinct.

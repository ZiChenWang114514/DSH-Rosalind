# OpenSlide CMU-1 public-source plan

- Specimen: OpenSlide CMU-1 brightfield whole-slide image
- Public URL: https://openslide.cs.cmu.edu/download/openslide-testdata/Aperio/CMU-1-JP2K-33005.svs
- Published byte count: `132565343`
- Published SHA-256: `9a1923cd9bcb260ba4d99d64f8d6e32550648c332ba48817f920662f3a513420`
- License: CC0-1.0, as recorded by the OpenSlide test-data index

This case does not download the 132.6 MB slide. The identity above is a public-source plan for a later authorized session. No source path, viewer session, pathology job, model output, or tissue image is retained here.

## Current Slide Viewer contract snapshot

The current callable interface exposes:

- `slide-viewer.slide_get_pathology`
- `slide-viewer.slide_cancel_pathology`
- `slide-viewer.slide_resume_pathology`

It does not expose `slide-viewer.slide_run_pathology`. A new pathology job therefore cannot be started from this task. All three listed operations are represented only as rehearsed state transitions.

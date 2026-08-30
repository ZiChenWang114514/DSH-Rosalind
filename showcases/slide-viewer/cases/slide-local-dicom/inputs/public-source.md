# Public CMU-1 DICOM series

- Dataset: `erikgabr/wsi-testdata`, public and ungated on Hugging Face.
- Dataset revision checked: `8fd723261c7afb81f74e619e9ee0c855f87b2ffc`.
- Series record: <https://huggingface.co/datasets/erikgabr/wsi-testdata/resolve/main/dicom/CMU-1-JP2K-33005/metadata.json>
- Member inventory: <https://huggingface.co/api/datasets/erikgabr/wsi-testdata/tree/main/dicom/CMU-1-JP2K-33005?recursive=false&expand=false>
- Upstream OpenSlide record: <https://openslide.cs.cmu.edu/download/openslide-testdata/index.json>
- Recorded source: conversion of `CMU-1-JP2K-33005.svs`, DICOM WSI, TILED_FULL, JPEG 2000, CC0-1.0.

The six named DICOM members total 136,926,512 bytes. The package retains their published byte counts and SHA-256 values in `outputs/verification-receipt.json`; the source files remain in the ignored public-example directory and are not part of the teaching package.

The current OpenSlide index marks the older `CMU-1-JP2K-33005.zip` conversion as deprecated because its Photometric Interpretation is incorrect. A corrected `-v2.zip` exists, but this case deliberately checks the six members specified in the design portfolio and does not substitute another conversion.

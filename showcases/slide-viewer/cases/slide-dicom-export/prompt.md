# Validate a metadata-only DICOM WSI export plan

Validate the compact DICOM JSON fixture against the public DICOM JSON model and VL Whole Slide Microscopy SOP Class UID. Check UIDs, frame coverage, tile geometry, RGB metadata, excluded sensitive tags, and the planned output identities. Inspect `outputs/rosalind-open-observation.json`, the case-specific `mcp__rosalind__rosalind_open` invocation, and its exact launcher response. Do not read or write a DICOM instance, query DICOMweb, prepare or submit an upload, or present the Rosalind task chooser as a DICOM or scientific operation.

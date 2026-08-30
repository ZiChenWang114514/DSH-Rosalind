# Public DICOM standard sources

- DICOM PS3.18 2026c, DICOM JSON Model: https://dicom.nema.org/medical/dicom/current/output/chtml/part18/sect_F.2.html
- DICOM PS3.4 2026c, Standard SOP Classes: https://dicom.nema.org/medical/dicom/current/output/chtml/part04/sect_B.5.html
- VL Whole Slide Microscopy Image Storage SOP Class UID: `1.2.840.10008.5.1.4.1.1.77.1.6`

`inputs/dicom-metadata.json` is a self-contained DICOM JSON metadata fixture. Its `2.25` UIDs are deterministic fixture values, not identifiers copied from a clinical object. The fixture contains no patient name, patient ID, accession, institution, study description, pixel data, bulk-data URI, local path, or credential.

The case performs metadata validation and local export planning only. It does not query DICOMweb, read an instance, import or export a DICOM object, prepare an upload, or submit an upload.

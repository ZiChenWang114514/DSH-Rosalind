# IDC public DICOMweb WSI

- IDC selection manifest: <https://raw.githubusercontent.com/ImagingDataCommons/wg26-2026-connectathon-idc/main/data/manifest/wg26_selection.json>
- IDC proxy policy: <https://learn.canceridc.dev/portal/proxy-policy>
- Anonymous DICOMweb base: `https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb`
- Study Instance UID: `2.25.326831351899246997718579660054873448065`
- Series Instance UID: `1.3.6.1.4.1.5962.99.1.3052275118.437477262.1772578833838.4.0`
- IDC manifest description: HCMI FFPE H&E, three SM instances, CC BY 4.0.

The three selected SOP Instance UIDs are retained in `outputs/verification-receipt.json`. The endpoint did not return ETags for the inspected metadata or frame resources, so `outputs/dicomweb-representation-manifest.json` pins the exact three metadata payloads and all fourteen frame payloads by byte count and SHA-256.

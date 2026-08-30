# Third-party notices

DSH-Rosalind source code is licensed under Apache-2.0. Project-authored documentation and visual material are licensed under CC BY 4.0. Scientific records and retained example files remain subject to their original licences and citation requirements.

The release catalogue is derived from the public `rosalind-science-showcases` snapshot at commit `f81e668c69edbfe7863cc936f2d535b61d8df76b`. Each case directory contains its own source URLs, provenance records, limitations, and available licensing metadata. Those records take precedence over this summary.

The runtime integrates with DeepSeek Harness 0.1.1-rc.2 and may optionally connect to PubMed, PMC, bioRxiv/medRxiv, Open Targets, GWAS Catalog, GTEx, ClinVar, Ensembl, PheWAS services, UniProt, ChEMBL, RCSB PDB, Reactome, Boltz, Biohub ESM, Modal, Runpod, and user-configured SSH/HPC systems. The respective services retain their trademarks, terms, licences, and data policies.

No OpenAI or Rosalind product artwork is included. The DSH-Rosalind mark and interface artwork in this repository are original project assets.

The FASTQ QC lesson includes the first 500 complete records derived from ENA run `DRR037765`. Its case-level provenance file records the public source URL, source MD5, deterministic transformation, and subset digest. ENA source data remains subject to the source record's terms and citation requirements.

## Public-service integrations

The bundled `skills/` documents are authored and maintained by the DSH-Rosalind project. They describe how this package uses its own typed DSH tools to reach the public services named above. The npm package does not include third-party plugin source trees or their documentation.

Fixed plugin names and versions in capability metadata identify the interfaces studied for compatibility. Design-research mirrors, screenshots, and experimental iframe adapters are kept outside the repository and are not compiled into `lib/client.js` or included in the npm archive.

Service names and trademarks identify interoperating public platforms only. They do not imply endorsement or affiliation. Users remain responsible for complying with each service's current terms, licences, rate limits, access rules, and citation guidance.

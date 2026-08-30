# Source and fixture

The catalogue binding checked by NGS Analysis Workbench is `oai_fastq_qc`, the bundled Snakemake workflow at version `version-8e0c15a605d394be27a4e68246a061ef`. Its recorded source digest is `sha256:705bf609376de4193dafbb50a8967b75bc30ffeb5c17e1849a56cafe949db201`.

The retained two-record FASTQ is an unmodified prefix of:

`https://raw.githubusercontent.com/nf-core/test-datasets/5f09ab078a7459db38c1ec86712a98d369cf7863/illumina/amplicon/sample1_R1.fastq.gz`

The source file contains 27,721 records. `inputs/public-fixture.fastq` contains the first two complete records after gzip decompression. It is used only to test FASTQ parsing and a local workflow definition; it is too small for biological or library-quality conclusions.

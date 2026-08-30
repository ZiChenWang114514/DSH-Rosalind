# Source and fixture

The catalogue binding checked by NGS Analysis Workbench is `fastq_qc`, which resolves to `nf-core/demo` revision `1.2.0` and workflow version `version-f645b8d9af970b92e847e05b9509d9af`.

The retained two-record FASTQ is an unmodified prefix of:

`https://raw.githubusercontent.com/nf-core/test-datasets/5f09ab078a7459db38c1ec86712a98d369cf7863/illumina/amplicon/sample1_R1.fastq.gz`

The source file contains 27,721 records. `inputs/public-fixture.fastq` contains the first two complete records after gzip decompression. It is used only to test FASTQ parsing and a local workflow definition; it is too small for biological or library-quality conclusions.

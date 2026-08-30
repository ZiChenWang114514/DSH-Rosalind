# Source and fixture

The retained FASTQ is an unmodified two-record prefix of:

`https://raw.githubusercontent.com/nf-core/test-datasets/5f09ab078a7459db38c1ec86712a98d369cf7863/illumina/amplicon/sample1_R1.fastq.gz`

The full public source contains 27,721 reads. `inputs/public-fixture.fastq.txt` contains the first two complete 301-base records after gzip decompression; the `.txt` suffix keeps this small teaching fixture visible to repository tooling. It supports deterministic parser and summary-format checks only and is too small and nonrepresentative for library-quality or biological conclusions.

The case uses no registered NGS Analysis Workbench run. Its analysis summary reviews a completed local Python reference computation and demonstrates the evidence requirements that would also apply to a registered run.

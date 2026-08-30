nextflow.enable.dsl=2

params.reads = "${projectDir}/../inputs/public-fixture.fastq"

process FASTQ_STATS {
    tag "public two-read prefix"

    input:
    path reads

    output:
    path "native-fastq-stats.json"

    script:
    """
    python3 ${projectDir}/../scripts/reference_fastq_stats.py ${reads} native-fastq-stats.json
    """
}

workflow {
    FASTQ_STATS(file(params.reads))
}

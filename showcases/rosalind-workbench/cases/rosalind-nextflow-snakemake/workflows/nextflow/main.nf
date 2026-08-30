nextflow.enable.dsl = 2

params.input = "inputs/DRR037765-first-500.fastq"
params.output = "outputs/nextflow/qc.json"

process FASTQ_QC {
    input:
    path reads

    output:
    path "qc.json"

    script:
    """
    python ${projectDir}/../../qc_core.py ${reads} qc.json
    """
}

workflow {
    FASTQ_QC(file(params.input))
}

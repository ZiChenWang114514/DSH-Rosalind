#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 INPUT_YAML_DIR OUTPUT_DIR [SEED]" >&2
  exit 2
fi

INPUT_DIR=$1
OUTPUT_DIR=$2
SEED=${3:-20260829}

boltz predict "$INPUT_DIR" \
  --out_dir "$OUTPUT_DIR" \
  --use_msa_server \
  --diffusion_samples 5 \
  --max_parallel_samples 1 \
  --seed "$SEED"

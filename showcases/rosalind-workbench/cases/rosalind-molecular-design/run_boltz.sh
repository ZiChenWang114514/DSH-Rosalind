#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 4 ]; then
  echo "usage: $0 INPUT_YAML_OR_DIR OUTPUT_DIR [DIFFUSION_SAMPLES] [SEED]" >&2
  exit 2
fi

INPUT_PATH=$1
OUTPUT_DIR=$2
DIFFUSION_SAMPLES=${3:-1}
SEED=${4:-20260829}

boltz predict "$INPUT_PATH" \
  --out_dir "$OUTPUT_DIR" \
  --use_msa_server \
  --diffusion_samples "$DIFFUSION_SAMPLES" \
  --max_parallel_samples 1 \
  --seed "$SEED"

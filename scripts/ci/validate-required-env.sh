#!/usr/bin/env bash
set -euo pipefail

missing=()
for name in "$@"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if ((${#missing[@]} > 0)); then
  printf '::error::Missing required deployment values: %s\n' "${missing[*]}"
  exit 1
fi

printf 'Validated required deployment values: %s\n' "$*"

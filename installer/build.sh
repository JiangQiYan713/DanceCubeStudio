#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p ../release
if [ -n "${STUDIO_REPOSITORY:-}" ]; then
  printf '%s' "$STUDIO_REPOSITORY" | python3 -c 'import re,sys;sys.exit(0 if re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(?:\.git)?",sys.stdin.read()) else 1)'
fi
makensis -INPUTCHARSET UTF8 "-DREPO_URL=${STUDIO_REPOSITORY:-}" "-DOUTPUT=../release/DanceCube-Studio-setup.exe" setup.nsi

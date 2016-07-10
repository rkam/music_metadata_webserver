#!/bin/bash
set -uo pipefail
IFS=$'\n\t'

usage()
{
  echo "usage: $(basename "$0") pid_of_failed_run"
  exit ${1:-0}
}

cd _test_data/

if [[ $# == 1 ]]; then
  FAIL_CASE="$1"
else
  FAIL_CASES=$(echo [0-9]* | sed -e 's/_.*$//' | sort -u)

  [[ "$FAIL_CASES" =~ ' ' ]] && usage 1
  FAIL_CASE="$FAIL_CASES"
fi

[[ -z "$FAIL_CASE" ]] && usage 1

for fail in ${FAIL_CASE}_music_summary_test*
do
  s=${fail#${FAIL_CASE}_}
  r=${s%.xxx}
  ok=sample_${r}_data.xxx

  echo "$ok"
  diff -qwb "$fail" "$ok" > /dev/null 2>&1
  if [[ $? -ne 0 ]]; then
    icdiff --highlight "$ok" "$fail"
  else
    echo "identical?"
  fi
done

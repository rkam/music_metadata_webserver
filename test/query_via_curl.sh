#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

if [[ $# == 0 ]]; then
  curl -s -S http://localhost:8069/music/summary | json_pp
else
  curl -s -S "http://localhost:8069/music/summary/0.$1" | json_pp
fi

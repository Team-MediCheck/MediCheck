#!/usr/bin/env bash
# sync-by-sido 가 날짜가 바뀌면 progress.regions 를 초기화하므로,
# hospitals-done / full-done 영구 마커와 연동되도록 skip 판정을 보강하기 위한 래퍼는
# run-daily.sh 가 담당한다. 이 파일은 LaunchAgent 엔트리포인트.

set -euo pipefail
exec /Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/run-daily.sh

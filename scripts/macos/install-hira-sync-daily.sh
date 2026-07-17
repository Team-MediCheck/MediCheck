#!/usr/bin/env bash
# com.medicheck.hira-sync-daily LaunchAgent 설치/제거
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.medicheck.hira-sync-daily"
PLIST_SRC="${ROOT}/scripts/macos/${LABEL}.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
UID_NUM="$(id -u)"

usage() {
  cat <<EOF
Usage: $(basename "$0") install|uninstall|status

  install   - LaunchAgent 등록 (매일 03:30, run-daily.sh 실행)
  uninstall - LaunchAgent 해제
  status    - launchctl 목록에서 확인
EOF
}

cmd="${1:-}"
case "$cmd" in
  install)
    chmod +x "${ROOT}/scripts/sync/launch-daily.sh" "${ROOT}/scripts/sync/run-daily.sh" "${ROOT}/scripts/sync/sync-by-sido.sh"
    mkdir -p "${ROOT}/scripts/sync/state"
    cp "$PLIST_SRC" "$PLIST_DST"
    launchctl bootout "gui/${UID_NUM}" "$PLIST_DST" 2>/dev/null || true
    launchctl bootstrap "gui/${UID_NUM}" "$PLIST_DST"
    echo "Installed ${LABEL} → ${PLIST_DST}"
    echo "Logs: ${ROOT}/scripts/sync/state/daily-runner.log"
    ;;
  uninstall)
    launchctl bootout "gui/${UID_NUM}" "$PLIST_DST" 2>/dev/null || true
    rm -f "$PLIST_DST"
    echo "Uninstalled ${LABEL}"
    ;;
  status)
    launchctl print "gui/${UID_NUM}/${LABEL}" 2>/dev/null || echo "Not loaded: ${LABEL}"
    ;;
  *)
    usage
    exit 1
    ;;
esac

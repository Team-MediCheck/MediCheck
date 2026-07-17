#!/usr/bin/env bash
# 전국 HIRA 동기화 일일 러너 (Cursor 없이도 맥미니 LaunchAgent로 동작)
#
# 공공데이터 일일 한도 10,000건은 병원·평가·Top5 API 호출을 합산한 공유 한도입니다.
# DAILY_BUDGET(기본 9,000)으로 당일 총 호출 상한을 두고, Phase 1(병원) → Phase 2(평가·Top5) 순으로 소진합니다.
#
# LaunchAgent가 매일 실행. --skip-done 으로 이어감.

set -euo pipefail

ROOT="/Users/snowrabbit123/Desktop/Medicheck/MediCheck"
STATE_DIR="${ROOT}/scripts/sync/state"
LOG="${STATE_DIR}/daily-runner.log"
LOCK="${STATE_DIR}/runner.lock"
COMPLETE="${STATE_DIR}/COMPLETED"
SCRIPT="${ROOT}/scripts/sync/sync-by-sido.sh"
export BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
export DAILY_BUDGET="${DAILY_BUDGET:-9000}"
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/Users/snowrabbit123/.local/bin:/usr/bin:/bin"

mkdir -p "$STATE_DIR"
exec >>"$LOG" 2>&1

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

if [[ -f "$COMPLETE" ]]; then
  log "이미 전국 동기화 완료됨 ($COMPLETE). 종료."
  exit 0
fi

# 단일 실행 잠금
if [[ -f "$LOCK" ]]; then
  old="$(cat "$LOCK" 2>/dev/null || true)"
  if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
    log "이미 실행 중 (pid=$old). 종료."
    exit 0
  fi
fi
echo $$ >"$LOCK"
trap 'rm -f "$LOCK"' EXIT

# Docker 대기
for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1 && curl -fsS -o /dev/null --max-time 3 "$BASE_URL/" ; then
    break
  fi
  [[ $i -eq 1 ]] && open -a Docker 2>/dev/null || true
  sleep 5
done

if ! curl -fsS -o /dev/null --max-time 5 "$BASE_URL/" ; then
  log "ERROR: backend unreachable at $BASE_URL"
  exit 1
fi

all_hospitals_done() {
  python3 - <<'PY'
import json
from pathlib import Path
sidos = ["110000","260000","270000","280000","290000","300000","310000","360000","410000","420000","430000","440000","450000","460000","470000","480000","490000"]
p = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/progress.json")
if not p.exists():
    raise SystemExit(1)
data = json.loads(p.read_text())
# hospitals progress is per calendar day in progress.json — for multi-day we need persistent completion
# Use companion file hospitals-done.json if present
done_path = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/hospitals-done.json")
done = set(json.loads(done_path.read_text())) if done_path.exists() else set()
# also treat today's progress hospitals=done as done
regs = data.get("regions", {})
for s in sidos:
    if regs.get(s, {}).get("hospitals") == "done":
        done.add(s)
missing = [s for s in sidos if s not in done]
raise SystemExit(0 if not missing else 1)
PY
}

persist_hospital_progress() {
  python3 - <<'PY'
import json
from pathlib import Path
sidos = ["110000","260000","270000","280000","290000","300000","310000","360000","410000","420000","430000","440000","450000","460000","470000","480000","490000"]
state = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state")
done_path = state / "hospitals-done.json"
prog_path = state / "progress.json"
done = set(json.loads(done_path.read_text())) if done_path.exists() else set()
if prog_path.exists():
    regs = json.loads(prog_path.read_text()).get("regions", {})
    for s in sidos:
        if regs.get(s, {}).get("hospitals") == "done":
            done.add(s)
done_path.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2) + "\n")
print(f"hospitals_done={len(done)}/17")
PY
}

all_full_done() {
  python3 - <<'PY'
import json
from pathlib import Path
sidos = ["110000","260000","270000","280000","290000","300000","310000","360000","410000","420000","430000","440000","450000","460000","470000","480000","490000"]
full_path = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/full-done.json")
prog_path = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/progress.json")
done = set(json.loads(full_path.read_text())) if full_path.exists() else set()
if prog_path.exists():
    regs = json.loads(prog_path.read_text()).get("regions", {})
    for s in sidos:
        r = regs.get(s, {})
        if r.get("hospitals")=="done" and r.get("evaluations")=="done" and r.get("top5")=="done":
            done.add(s)
full_path.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2) + "\n")
print(f"full_done={len(done)}/17")
raise SystemExit(0 if len(done) >= 17 else 1)
PY
}

log "=== daily runner start budget=${DAILY_BUDGET} base=${BASE_URL} ==="

# Phase 1: hospitals for all sidos
if ! all_hospitals_done; then
  log "Phase 1: hospitals-only (skip-done)"
  # Prefer smaller regions first by excluding already-done via skip-done;
  # Seoul may already be in DB from interrupted run — still call once with skip if marked.
  # Seed Seoul as hospitals-done if DB already filled from interrupted sync.
  python3 - <<'PY'
import json
from pathlib import Path
p = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/hospitals-done.json")
done = set(json.loads(p.read_text())) if p.exists() else set()
# Seoul finished on server (totalCount~19862) even if client died
done.add("110000")
p.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2) + "\n")
print("seeded Seoul hospitals-done")
PY

  # Build --only list of missing hospital regions
  ONLY="$(python3 - <<'PY'
import json
from pathlib import Path
sidos = ["260000","270000","280000","290000","300000","310000","360000","410000","420000","430000","440000","450000","460000","470000","480000","490000","110000"]
done_path = Path("/Users/snowrabbit123/Desktop/Medicheck/MediCheck/scripts/sync/state/hospitals-done.json")
done = set(json.loads(done_path.read_text())) if done_path.exists() else set()
missing = [s for s in sidos if s not in done]
print(",".join(missing))
PY
)"
  if [[ -n "$ONLY" ]]; then
    log "hospitals missing: $ONLY"
    BASE_URL="$BASE_URL" DAILY_BUDGET="$DAILY_BUDGET" \
      "$SCRIPT" --hospitals-only --skip-done --only "$ONLY" || log "hospitals phase exited $?"
    persist_hospital_progress
  else
    log "hospitals already complete"
  fi
else
  log "Phase 1 already complete"
fi

# Phase 2: evaluations + top5
log "Phase 2: evaluations + top5 (skip-done)"
BASE_URL="$BASE_URL" DAILY_BUDGET="$DAILY_BUDGET" \
  "$SCRIPT" --skip-done || log "full phase exited $?"

# Merge today's progress into full-done
if all_full_done; then
  date >"$COMPLETE"
  log "전국 동기화 완료! COMPLETED 생성"
else
  log "아직 미완료. 내일 이어서 진행."
  all_full_done || true
fi

log "=== daily runner end ==="

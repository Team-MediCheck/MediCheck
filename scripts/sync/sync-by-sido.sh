#!/usr/bin/env bash
# 시·도별 HIRA 동기화 (병원 → 평가 → Top5)
#
# 공공데이터포털 개발계정 일일 한도 10,000건은 병원·평가·Top5 API를 합산한 공유 한도입니다.
# 기본 예산(DAILY_BUDGET)은 9,000으로 두고, 병원→평가→Top5 순으로 소진하며 예산 소진 시 당일 중단합니다.
# 진행 상태는 scripts/sync/state/progress.json 에 저장되어 다음날/중단 후 이어갈 수 있습니다.
#
# 사용 예:
#   ./scripts/sync/sync-by-sido.sh --list
#   ./scripts/sync/sync-by-sido.sh --status              # 체크리스트 진행 현황
#   ./scripts/sync/sync-by-sido.sh --checklist           # --status 와 동일
#   ./scripts/sync/sync-by-sido.sh --only 270000              # 대구만
#   ./scripts/sync/sync-by-sido.sh --only 110000,410000       # 서울·경기
#   ./scripts/sync/sync-by-sido.sh --sggu-only 110000         # 서울 구별 병원 동기화
#   ./scripts/sync/sync-by-sido.sh --hospitals-only
#   ./scripts/sync/sync-by-sido.sh --skip-done                # 오늘 완료분 건너뛰기
#   ./scripts/sync/sync-by-sido.sh --dry-run
#   BASE_URL=http://127.0.0.1:8080 ./scripts/sync/sync-by-sido.sh
#
# 인증:
#   ADMIN_SYNC_KEY 환경변수 또는 backend/server/.env.prod 의 ADMIN_SYNC_KEY
#
# 위치 fallback:
#   /sync/region 이 fetchedCount=0 (키는 설정된 경우)이면 sido-catalog.sh 좌표로
#   /sync/location 을 자동 재시도합니다.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="${ROOT}/scripts/sync/state"
STATE_FILE="${STATE_DIR}/progress.json"
BASE_URL="${BASE_URL:-https://medicheck.life}"
NUM_OF_ROWS="${NUM_OF_ROWS:-500}"
DAILY_BUDGET="${DAILY_BUDGET:-9000}"
MAX_EVAL="${MAX_EVAL:-}"          # 비우면 지역 병원 전체
MAX_TOP5="${MAX_TOP5:-}"          # 비우면 지역 병원 전체
SLEEP_SEC="${SLEEP_SEC:-1}"
TODAY="$(date +%F)"

# shellcheck source=sido-catalog.sh
source "${SCRIPT_DIR}/sido-catalog.sh"
# shellcheck source=sggu-catalog.sh
source "${SCRIPT_DIR}/sggu-catalog.sh"

ONLY=""
SGGU_ONLY=""
HOSPITALS_ONLY=0
EVAL_ONLY=0
TOP5_ONLY=0
SKIP_DONE=0
DRY_RUN=0
LIST_ONLY=0
STATUS_ONLY=0

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) LIST_ONLY=1; shift ;;
    --status|--checklist) STATUS_ONLY=1; shift ;;
    --only) ONLY="${2:-}"; shift 2 ;;
    --sggu-only) SGGU_ONLY="${2:-}"; shift 2 ;;
    --hospitals-only) HOSPITALS_ONLY=1; shift ;;
    --eval-only) EVAL_ONLY=1; shift ;;
    --top5-only) TOP5_ONLY=1; shift ;;
    --skip-done) SKIP_DONE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --budget) DAILY_BUDGET="${2:-}"; shift 2 ;;
    --base-url) BASE_URL="${2:-}"; shift 2 ;;
    --max-eval) MAX_EVAL="${2:-}"; shift 2 ;;
    --max-top5) MAX_TOP5="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

load_admin_key() {
  if [[ -n "${ADMIN_SYNC_KEY:-}" ]]; then
    return 0
  fi
  local env_file="${ROOT}/backend/server/.env.prod"
  if [[ -f "$env_file" ]]; then
    # shellcheck disable=SC1090
    ADMIN_SYNC_KEY="$(grep -E '^ADMIN_SYNC_KEY=' "$env_file" | tail -1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
  fi
  if [[ -z "${ADMIN_SYNC_KEY:-}" ]]; then
    echo "ADMIN_SYNC_KEY 가 없습니다. 환경변수 또는 backend/server/.env.prod 를 확인하세요." >&2
    exit 1
  fi
}

init_state() {
  mkdir -p "$STATE_DIR"
  python3 - "$STATE_FILE" "$TODAY" "$DAILY_BUDGET" <<'PY'
import json, sys
from pathlib import Path
path, today, budget = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
if path.exists():
    data = json.loads(path.read_text())
else:
    data = {}
if data.get("date") != today:
    data = {"date": today, "estimatedCalls": 0, "dailyBudget": budget, "regions": {}}
else:
    data["dailyBudget"] = budget
    data.setdefault("regions", {})
    data.setdefault("estimatedCalls", 0)
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(data["estimatedCalls"])
PY
}

state_get_calls() {
  python3 - "$STATE_FILE" <<'PY'
import json, sys
from pathlib import Path
print(json.loads(Path(sys.argv[1]).read_text()).get("estimatedCalls", 0))
PY
}

state_add_calls() {
  local n="$1"
  python3 - "$STATE_FILE" "$n" <<'PY'
import json, sys
from pathlib import Path
path, n = Path(sys.argv[1]), int(sys.argv[2])
data = json.loads(path.read_text())
data["estimatedCalls"] = int(data.get("estimatedCalls", 0)) + n
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
print(data["estimatedCalls"])
PY
}

region_done() {
  local sido="$1" step="$2"
  python3 - "$STATE_FILE" "$sido" "$step" <<'PY'
import json, sys
from pathlib import Path
path, sido, step = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
state = path.parent

if step == "hospitals":
    hp = state / "hospitals-done.json"
    if hp.exists() and sido in json.loads(hp.read_text()):
        print("1"); raise SystemExit(0)
if step in ("evaluations", "top5"):
    fp = state / "full-done.json"
    if fp.exists() and sido in json.loads(fp.read_text()):
        print("1"); raise SystemExit(0)

data = json.loads(path.read_text()) if path.exists() else {}
reg = data.get("regions", {}).get(sido, {})
print("1" if reg.get(step) == "done" else "0")
PY
}

region_mark() {
  local sido="$1" step="$2" detail="$3"
  python3 - "$STATE_FILE" "$sido" "$step" "$detail" <<'PY'
import json, sys
from datetime import datetime, timezone
from pathlib import Path
path, sido, step, detail = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
data = json.loads(path.read_text())
reg = data.setdefault("regions", {}).setdefault(sido, {})
reg[step] = "done"
reg[f"{step}At"] = datetime.now(timezone.utc).isoformat()
reg[f"{step}Detail"] = detail
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

state = path.parent
if step == "hospitals":
    hp = state / "hospitals-done.json"
    done = set(json.loads(hp.read_text())) if hp.exists() else set()
    done.add(sido)
    hp.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2) + "\n")

r = data["regions"][sido]
if r.get("hospitals") == "done" and r.get("evaluations") == "done" and r.get("top5") == "done":
    fp = state / "full-done.json"
    done = set(json.loads(fp.read_text())) if fp.exists() else set()
    done.add(sido)
    fp.write_text(json.dumps(sorted(done), ensure_ascii=False, indent=2) + "\n")
PY
}

should_include() {
  local sido="$1"
  if [[ -z "$ONLY" ]]; then
    return 0
  fi
  [[ ",${ONLY}," == *",${sido},"* ]]
}

lookup_sido() {
  # stdout: name|keyword|lat|lng|radius  (or empty if not found)
  local sido="$1" row code name kw lat lng radius
  for row in "${SIDO_CATALOG[@]}"; do
    IFS='|' read -r code name kw lat lng radius <<<"$row"
    if [[ "$code" == "$sido" ]]; then
      printf '%s|%s|%s|%s|%s' "$name" "$kw" "$lat" "$lng" "$radius"
      return 0
    fi
  done
  return 1
}

sggu_rows_for_sido() {
  local sido="$1" row code sggu name
  for row in "${SGGU_CATALOG[@]}"; do
    IFS='|' read -r code sggu name <<<"$row"
    if [[ "$code" == "$sido" ]]; then
      printf '%s\n' "$row"
    fi
  done
}

api_post() {
  local path_qs="$1"
  local url="${BASE_URL%/}${path_qs}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN POST ${url}"
    # dry-run 은 상태/완료 마커를 건드리지 않음 (호출부에서 조기 return)
    echo '{"dryRun":true,"fetchedCount":0,"keyConfigured":true,"saved":0,"updated":0}'
    return 0
  fi
  curl -fsS -X POST "$url" \
    -H "X-Admin-Key: ${ADMIN_SYNC_KEY}" \
    -H "Accept: application/json" \
    --max-time 7200
}

json_get() {
  # usage: json_get BODY KEY [DEFAULT]
  local body="$1" key="$2" default="${3:-0}"
  BODY="$body" KEY="$key" DEFAULT="$default" python3 - <<'PY'
import json, os
raw = os.environ.get("BODY", "")
key = os.environ["KEY"]
default = os.environ.get("DEFAULT", "0")
try:
    d = json.loads(raw)
    if isinstance(d, dict):
        v = d.get(key, default)
    elif isinstance(d, int):
        v = d
    else:
        v = default
    print(v if v is not None else default)
except Exception:
    print(default)
PY
}

estimate_hospital_calls() {
  # fetchedCount / numOfRows 올림 (최소 1)
  local fetched="$1"
  python3 - "$fetched" "$NUM_OF_ROWS" <<'PY'
import math, sys
fetched, rows = int(sys.argv[1]), int(sys.argv[2])
print(max(1, math.ceil(max(fetched, 1) / max(rows, 1))))
PY
}

budget_left_or_stop() {
  local used left
  used="$(state_get_calls)"
  left=$((DAILY_BUDGET - used))
  if [[ "$left" -le 0 ]]; then
    return 1
  fi
  echo "$left"
  return 0
}

budget_cap_for_step() {
  # stdout: 이번 단계 maxSynced(=최대 API 호출 수). 실패 시 예산 소진.
  local explicit_max="${1:-}"
  local left
  left="$(budget_left_or_stop)" || return 1
  if [[ -n "$explicit_max" && "$explicit_max" -lt "$left" ]]; then
    echo "$explicit_max"
  else
    echo "$left"
  fi
}

parse_region_sync_body() {
  # stdout: synced|attempted|complete
  local body="$1"
  BODY="$body" python3 - <<'PY'
import json, os
raw = os.environ.get("BODY", "").strip()
synced = attempted = 0
complete = False
try:
    d = json.loads(raw)
    if isinstance(d, dict):
        synced = int(d.get("synced", d.get("evaluationsSynced", 0)) or 0)
        attempted = int(d.get("attempted", d.get("hospitalsAttempted", synced)) or 0)
        complete = bool(d.get("complete", False))
    elif isinstance(d, int):
        synced = attempted = d
        complete = True
except Exception:
    pass
print(f"{synced}|{attempted}|{int(complete)}")
PY
}

sync_hospitals_location_fallback() {
  local sido="$1" name="$2" lat="$3" lng="$4" radius="$5"
  if [[ -z "$lat" || -z "$lng" || -z "$radius" ]]; then
    log "위치 fallback 좌표 없음: ${name}(${sido})"
    echo "0|0|0|0"
    return 0
  fi
  log "위치 fallback: ${name} lat=${lat} lng=${lng} radius=${radius}"
  local body
  body="$(api_post "/api/hospitals/sync/location?lat=${lat}&lng=${lng}&radiusMeters=${radius}&numOfRows=${NUM_OF_ROWS}")"
  local fetched saved updated calls
  fetched="$(json_get "$body" fetchedCount 0)"
  saved="$(json_get "$body" saved 0)"
  updated="$(json_get "$body" updated 0)"
  calls="$(estimate_hospital_calls "$fetched")"
  state_add_calls "$calls" >/dev/null
  printf '%s|%s|%s|%s' "$fetched" "$saved" "$updated" "$calls"
}

sync_hospitals_sggu() {
  local sido="$1" name="$2"
  local rows total_fetched=0 total_saved=0 total_updated=0 total_calls=0
  rows="$(sggu_rows_for_sido "$sido")"
  if [[ -z "$rows" ]]; then
    log "sggu 카탈로그에 ${name}(${sido}) 항목이 없습니다."
    return 1
  fi

  local line code sggu sggu_name body fetched saved updated calls
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    IFS='|' read -r code sggu sggu_name <<<"$line"
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "DRY-RUN 병원(sggu): ${name}/${sggu_name} sidoCd=${sido}&sgguCd=${sggu}"
      api_post "/api/hospitals/sync/region?sidoCd=${sido}&sgguCd=${sggu}&numOfRows=${NUM_OF_ROWS}" >/dev/null
      continue
    fi
    if ! budget_left_or_stop >/dev/null; then
      log "일일 공유 예산(${DAILY_BUDGET}) 소진 — sggu 병원 동기화 중단"
      return 2
    fi
    log "병원(sggu) 동기화: ${name}/${sggu_name}(${sggu})"
    body="$(api_post "/api/hospitals/sync/region?sidoCd=${sido}&sgguCd=${sggu}&numOfRows=${NUM_OF_ROWS}")"
    fetched="$(json_get "$body" fetchedCount 0)"
    saved="$(json_get "$body" saved 0)"
    updated="$(json_get "$body" updated 0)"
    calls="$(estimate_hospital_calls "$fetched")"
    state_add_calls "$calls" >/dev/null
    total_fetched=$((total_fetched + fetched))
    total_saved=$((total_saved + saved))
    total_updated=$((total_updated + updated))
    total_calls=$((total_calls + calls))
    log "  → fetched=${fetched} saved=${saved} updated=${updated} calls~${calls}"
    sleep "$SLEEP_SEC"
  done <<<"$rows"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN 병원(sggu) 종료: ${name} (상태 파일 미변경)"
    return 0
  fi
  region_mark "$sido" hospitals "sggu=1,fetched=${total_fetched},saved=${total_saved},updated=${total_updated},calls~${total_calls}"
  log "병원(sggu) 완료: ${name} fetched=${total_fetched} saved=${total_saved} updated=${total_updated} calls~${total_calls} (today=$(state_get_calls)/${DAILY_BUDGET})"
}

sync_hospitals() {
  local sido="$1" name="$2" lat="${3:-}" lng="${4:-}" radius="${5:-}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN 병원: ${name}(${sido}) → /sync/region (fetched=0 시 location fallback ${lat},${lng},r=${radius})"
    api_post "/api/hospitals/sync/region?sidoCd=${sido}&numOfRows=${NUM_OF_ROWS}" >/dev/null
    return 0
  fi
  if [[ "$SKIP_DONE" -eq 1 ]] && [[ "$(region_done "$sido" hospitals)" == "1" ]]; then
    log "skip hospitals ${name}(${sido}) — already done today"
    return 0
  fi
  if ! budget_left_or_stop >/dev/null; then
    log "일일 공유 예산(${DAILY_BUDGET}) 소진 — 병원 동기화 중단"
    return 2
  fi

  log "병원 동기화 시작: ${name}(${sido})"
  local body
  body="$(api_post "/api/hospitals/sync/region?sidoCd=${sido}&numOfRows=${NUM_OF_ROWS}")"
  local fetched saved updated calls key_cfg detail
  fetched="$(json_get "$body" fetchedCount 0)"
  saved="$(json_get "$body" saved 0)"
  updated="$(json_get "$body" updated 0)"
  key_cfg="$(json_get "$body" keyConfigured true)"

  # region 결과가 0이면 location fallback (키가 있을 때만)
  if [[ "$fetched" -eq 0 ]]; then
    if [[ "$key_cfg" == "False" || "$key_cfg" == "false" ]]; then
      log "경고: keyConfigured=false — HIRA 서비스 키 확인 필요. location fallback 생략."
      calls=1
      state_add_calls "$calls" >/dev/null
      region_mark "$sido" hospitals "fetched=0,keyConfigured=false,calls~${calls}"
      log "병원 완료: ${name} fetched=0 (키 미설정) (today=$(state_get_calls)/${DAILY_BUDGET})"
      sleep "$SLEEP_SEC"
      return 0
    fi
    log "region fetchedCount=0 — location fallback 시도 (${name})"
    # region 호출 자체도 최소 1콜로 집계
    state_add_calls 1 >/dev/null
    local fb
    fb="$(sync_hospitals_location_fallback "$sido" "$name" "$lat" "$lng" "$radius")"
    IFS='|' read -r fetched saved updated calls <<<"$fb"
    detail="region=0,locationFallback=1,fetched=${fetched},saved=${saved},updated=${updated},calls~$((1 + calls))"
    region_mark "$sido" hospitals "$detail"
    log "병원 완료(fallback): ${name} fetched=${fetched} saved=${saved} updated=${updated} (today=$(state_get_calls)/${DAILY_BUDGET})"
    sleep "$SLEEP_SEC"
    return 0
  fi

  calls="$(estimate_hospital_calls "$fetched")"
  state_add_calls "$calls" >/dev/null
  region_mark "$sido" hospitals "fetched=${fetched},saved=${saved},updated=${updated},calls~${calls}"
  log "병원 완료: ${name} fetched=${fetched} saved=${saved} updated=${updated} calls~${calls} (today=$(state_get_calls)/${DAILY_BUDGET})"
  sleep "$SLEEP_SEC"
}

sync_evaluations() {
  local sido="$1" name="$2" keyword="$3"
  local qs="addressKeyword=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$keyword")"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN 평가: ${name} keyword=${keyword}"
    api_post "/api/hospitals/sync/evaluations/region?${qs}" >/dev/null
    return 0
  fi
  if [[ "$SKIP_DONE" -eq 1 ]] && [[ "$(region_done "$sido" evaluations)" == "1" ]]; then
    log "skip evaluations ${name} — already done today"
    return 0
  fi
  local cap
  if ! cap="$(budget_cap_for_step "$MAX_EVAL")"; then
    log "일일 공유 예산(${DAILY_BUDGET}) 소진 — 평가 동기화 중단"
    return 2
  fi
  qs="${qs}&maxSynced=${cap}"

  log "평가 동기화 시작: ${name} keyword=${keyword} maxSynced=${cap} (shared $(state_get_calls)/${DAILY_BUDGET})"
  local body synced attempted complete calls detail
  body="$(api_post "/api/hospitals/sync/evaluations/region?${qs}")"
  IFS='|' read -r synced attempted complete <<<"$(parse_region_sync_body "$body")"
  calls="$attempted"
  [[ -z "$calls" || "$calls" == "None" ]] && calls=0
  state_add_calls "$calls" >/dev/null
  detail="synced=${synced},attempted=${attempted},calls=${calls},complete=${complete}"
  if [[ "$complete" == "1" ]]; then
    region_mark "$sido" evaluations "$detail"
    log "평가 완료: ${name} synced=${synced} attempted=${attempted} (today=$(state_get_calls)/${DAILY_BUDGET})"
  else
    log "평가 부분 완료: ${name} synced=${synced} attempted=${attempted} — 내일 이어감 (today=$(state_get_calls)/${DAILY_BUDGET})"
    sleep "$SLEEP_SEC"
    return 2
  fi
  sleep "$SLEEP_SEC"
}

sync_top5() {
  local sido="$1" name="$2" keyword="$3"
  local qs="addressKeyword=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$keyword")"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "DRY-RUN Top5: ${name} keyword=${keyword}"
    api_post "/api/hospitals/sync/top5/region?${qs}" >/dev/null
    return 0
  fi
  if [[ "$SKIP_DONE" -eq 1 ]] && [[ "$(region_done "$sido" top5)" == "1" ]]; then
    log "skip top5 ${name} — already done today"
    return 0
  fi
  local cap
  if ! cap="$(budget_cap_for_step "$MAX_TOP5")"; then
    log "일일 공유 예산(${DAILY_BUDGET}) 소진 — Top5 동기화 중단"
    return 2
  fi
  qs="${qs}&maxSynced=${cap}"

  log "Top5 동기화 시작: ${name} keyword=${keyword} maxSynced=${cap} (shared $(state_get_calls)/${DAILY_BUDGET})"
  local body synced attempted complete calls detail
  body="$(api_post "/api/hospitals/sync/top5/region?${qs}")"
  IFS='|' read -r synced attempted complete <<<"$(parse_region_sync_body "$body")"
  calls="$attempted"
  [[ -z "$calls" || "$calls" == "None" ]] && calls=0
  state_add_calls "$calls" >/dev/null
  detail="synced=${synced},attempted=${attempted},calls=${calls},complete=${complete}"
  if [[ "$complete" == "1" ]]; then
    region_mark "$sido" top5 "$detail"
    log "Top5 완료: ${name} synced=${synced} attempted=${attempted} (today=$(state_get_calls)/${DAILY_BUDGET})"
  else
    log "Top5 부분 완료: ${name} synced=${synced} attempted=${attempted} — 내일 이어감 (today=$(state_get_calls)/${DAILY_BUDGET})"
    sleep "$SLEEP_SEC"
    return 2
  fi
  sleep "$SLEEP_SEC"
}

print_list() {
  local row code name kw lat lng radius fallback sggu_n
  printf '%-8s %-6s %-8s %-6s %s\n' "sidoCd" "이름" "fallback" "sggu" "keyword / lat,lng,r"
  for row in "${SIDO_CATALOG[@]}"; do
    IFS='|' read -r code name kw lat lng radius <<<"$row"
    fallback="no"
    [[ -n "$lat" && -n "$lng" && -n "$radius" ]] && fallback="yes"
    sggu_n="$(sggu_rows_for_sido "$code" | grep -c . || true)"
    printf '%-8s %-6s %-8s %-6s %s / %s,%s,%s\n' "$code" "$name" "$fallback" "$sggu_n" "$kw" "$lat" "$lng" "$radius"
  done
}

print_status() {
  python3 - "$STATE_DIR" <<'PY'
import json
from pathlib import Path
import sys

state = Path(sys.argv[1])
catalog = [
    ("110000", "서울"), ("260000", "부산"), ("270000", "대구"), ("280000", "인천"),
    ("290000", "광주"), ("300000", "대전"), ("310000", "울산"), ("360000", "세종"),
    ("410000", "경기"), ("420000", "강원"), ("430000", "충북"), ("440000", "충남"),
    ("450000", "전북"), ("460000", "전남"), ("470000", "경북"), ("480000", "경남"),
    ("490000", "제주"),
]

hp = state / "hospitals-done.json"
fp = state / "full-done.json"
prog = state / "progress.json"

hospitals_done = set(json.loads(hp.read_text())) if hp.exists() else set()
full_done = set(json.loads(fp.read_text())) if fp.exists() else set()
progress = json.loads(prog.read_text()) if prog.exists() else {}
regions = progress.get("regions", {})
today = progress.get("date", "-")
calls = progress.get("estimatedCalls", 0)
budget = progress.get("dailyBudget", "-")

print(f"date={today}  estimatedCalls={calls}/{budget} (shared: hospitals+eval+top5)")
print(f"hospitals-done.json: {len(hospitals_done)}/17  full-done.json: {len(full_done)}/17")
print()
print(f"{'sidoCd':<8} {'이름':<6} {'hosp':<6} {'eval':<6} {'top5':<6} {'persist':<10}")
for code, name in catalog:
    reg = regions.get(code, {})
    h = "done" if (code in hospitals_done or reg.get("hospitals") == "done") else (reg.get("hospitals") or "-")
    e = "done" if (code in full_done or reg.get("evaluations") == "done") else (reg.get("evaluations") or "-")
    t = "done" if (code in full_done or reg.get("top5") == "done") else (reg.get("top5") or "-")
    persist = []
    if code in hospitals_done:
        persist.append("H")
    if code in full_done:
        persist.append("F")
    print(f"{code:<8} {name:<6} {h:<6} {e:<6} {t:<6} {(''.join(persist) or '-'):<10}")

missing_h = [c for c, _ in catalog if c not in hospitals_done and regions.get(c, {}).get("hospitals") != "done"]
missing_f = [c for c, _ in catalog if c not in full_done]
print()
print(f"병원 미완료: {', '.join(missing_h) if missing_h else '(없음)'}")
print(f"전체(평가·Top5) 미완료: {', '.join(missing_f) if missing_f else '(없음)'}")
PY
}

main() {
  if [[ "$LIST_ONLY" -eq 1 ]]; then
    print_list
    exit 0
  fi
  if [[ "$STATUS_ONLY" -eq 1 ]]; then
    print_status
    exit 0
  fi

  if [[ "$DRY_RUN" -eq 0 ]]; then
    load_admin_key
    init_state >/dev/null
  else
    mkdir -p "$STATE_DIR"
  fi
  log "BASE_URL=${BASE_URL}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "date=${TODAY} dry_run=1 (상태 파일·완료 마커 미변경)"
  else
    log "date=${TODAY} budget=${DAILY_BUDGET} used=$(state_get_calls) dry_run=0"
  fi

  # --sggu-only: 해당 시·도만 구별 병원 동기화
  if [[ -n "$SGGU_ONLY" ]]; then
    local info name kw lat lng radius
    info="$(lookup_sido "$SGGU_ONLY")" || {
      echo "알 수 없는 sidoCd: ${SGGU_ONLY}" >&2
      exit 1
    }
    IFS='|' read -r name kw lat lng radius <<<"$info"
    sync_hospitals_sggu "$SGGU_ONLY" "$name" || {
      local rc=$?
      [[ $rc -eq 2 ]] && exit 0
      exit "$rc"
    }
    if [[ "$DRY_RUN" -eq 1 ]]; then
      log "종료 (dry-run)."
    else
      log "종료. today estimatedCalls=$(state_get_calls)/${DAILY_BUDGET}"
      log "상태 파일: ${STATE_FILE}"
    fi
    exit 0
  fi

  local do_h=1 do_e=1 do_t=1
  if [[ "$HOSPITALS_ONLY" -eq 1 ]]; then do_e=0; do_t=0; fi
  if [[ "$EVAL_ONLY" -eq 1 ]]; then do_h=0; do_t=0; fi
  if [[ "$TOP5_ONLY" -eq 1 ]]; then do_h=0; do_e=0; fi

  local row code name kw lat lng radius
  for row in "${SIDO_CATALOG[@]}"; do
    IFS='|' read -r code name kw lat lng radius <<<"$row"
    should_include "$code" || continue

    if [[ "$do_h" -eq 1 ]]; then
      sync_hospitals "$code" "$name" "$lat" "$lng" "$radius" || { [[ $? -eq 2 ]] && break; }
    fi
    if [[ "$do_e" -eq 1 ]]; then
      sync_evaluations "$code" "$name" "$kw" || { [[ $? -eq 2 ]] && break; }
    fi
    if [[ "$do_t" -eq 1 ]]; then
      sync_top5 "$code" "$name" "$kw" || { [[ $? -eq 2 ]] && break; }
    fi
  done

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "종료 (dry-run)."
  else
    log "종료. today estimatedCalls=$(state_get_calls)/${DAILY_BUDGET}"
    log "상태 파일: ${STATE_FILE}"
  fi
}

main "$@"

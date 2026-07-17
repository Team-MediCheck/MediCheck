# MediCheck HIRA 시·도 동기화

병원 → 평가 → Top5 순으로 시·도별 HIRA 데이터를 채웁니다.  
공공데이터포털 **일일 10,000건 한도는 병원·평가·Top5 API를 합산한 공유 한도**입니다.  
`DAILY_BUDGET`(기본 9,000)과 `scripts/sync/state/progress.json`의 `estimatedCalls`로 당일 총 호출 수를 추적하며, 소진 시 당일 중단 후 다음 날 이어갑니다.

## Phase 개요

| Phase | 내용 | 플래그 |
|-------|------|--------|
| **1** | 시·도별 병원 목록 (`/sync/region`, 필요 시 `/sync/location`) | `--hospitals-only` |
| **2** | 평가 + Top5 (`/sync/evaluations/region`, `/sync/top5/region`) | `--eval-only` / `--top5-only` 또는 기본(전체) |

권장 순서: 전국 병원을 먼저 채운 뒤(`--hospitals-only`), 다음 날부터 평가·Top5를 이어서 진행.

## 사전 준비

```bash
export BASE_URL=http://127.0.0.1:8080   # 또는 https://medicheck.life
# ADMIN_SYNC_KEY 는 환경변수 또는 backend/server/.env.prod 에서 자동 로드
# (스크립트가 키 값을 출력하지 않습니다)
```

## 수동 일일 실행

```bash
# Phase 1 — 병원만
./scripts/sync/sync-by-sido.sh --hospitals-only --skip-done

# Phase 2 — 평가·Top5 (병원 완료 후)
./scripts/sync/sync-by-sido.sh --skip-done

# 특정 시·도만
./scripts/sync/sync-by-sido.sh --only 270000 --hospitals-only
./scripts/sync/sync-by-sido.sh --only 110000,410000
```

### Mac mini 무인 일일 실행 (LaunchAgent)

`run-daily.sh` → `launch-daily.sh` 가 Phase 1(병원) → Phase 2(평가·Top5) 를 `--skip-done` 으로 이어갑니다.  
`hospitals-done.json` / `full-done.json` 이 날짜가 바뀌어도 영구 완료를 기억합니다.

```bash
# 등록 (매일 03:30 KST — 공공데이터 일일 한도(10,000) 리셋 이후)
./scripts/macos/install-hira-sync-daily.sh install

# 상태 확인
./scripts/macos/install-hira-sync-daily.sh status
launchctl print "gui/$(id -u)/com.medicheck.hira-sync-daily"

# 해제
./scripts/macos/install-hira-sync-daily.sh uninstall

# 수동 1회 (LaunchAgent 없이)
./scripts/sync/run-daily.sh
```

로그: `scripts/sync/state/daily-runner.log`  
수동 실행만 할 때는 아래 `--skip-done` 명령을 직접 써도 됩니다.

## 체크리스트 / 상태

```bash
./scripts/sync/sync-by-sido.sh --list       # 17개 시·도 + location fallback 유무 + sggu 개수
./scripts/sync/sync-by-sido.sh --status     # hospitals-done / full-done / progress 대비 현황
./scripts/sync/sync-by-sido.sh --checklist  # --status 와 동일
```

상태 파일 (`scripts/sync/state/`, gitignore):

- `progress.json` — 당일 예상 호출 수·지역별 단계
- `hospitals-done.json` — 병원 Phase 완료 시·도
- `full-done.json` — 병원+평가+Top5 완료 시·도

## Location fallback

일부 시·도(예: 대구)에서 `/api/hospitals/sync/region?sidoCd=…` 가 `fetchedCount=0`을 반환할 수 있습니다.  
이때 스크립트는 `sido-catalog.sh`의 좌표로 `/api/hospitals/sync/location`을 자동 재시도합니다.

- 카탈로그: `scripts/sync/sido-catalog.sh` (`sidoCd|이름|keyword|lat|lng|radiusMeters`)
- `keyConfigured=false` 이면 fallback을 건너뛰고 경고만 남깁니다.

## 시군구(sggu) 세분 동기화

서울·경기처럼 큰 지역은 구·시 단위로 나눌 수 있습니다.

```bash
# 서울 25개 구 순회
./scripts/sync/sync-by-sido.sh --sggu-only 110000

# dry-run
./scripts/sync/sync-by-sido.sh --dry-run --sggu-only 110000
```

코드표: `scripts/sync/sggu-catalog.sh`  
(서울 25구 + 경기 주요 시·구 + 검증용 구미 `471900`. 나머지는 sido 단위 또는 location fallback.)

## 기타 옵션

| 옵션 | 설명 |
|------|------|
| `--dry-run` | API 호출 없이 URL만 로그 |
| `--skip-done` | 오늘/영속 완료분 건너뛰기 |
| `--budget N` | 당일 공유 예산 재설정 (병원+평가+Top5 합산) |
| `--base-url URL` | API 베이스 URL |
| `--max-eval N` / `--max-top5 N` | 평가·Top5 API 호출 상한 (남은 예산보다 크면 예산 우선) |

## 일일 API 한도 (공유)

- 포털 개발계정: **일 10,000건** (병원 목록 + 평가 + Top5 **합산**)
- 스크립트 기본 `DAILY_BUDGET=9000` — 1,000건 여유
- `progress.json`의 `estimatedCalls`는 세 종류 호출을 합친 추정치
- 평가·Top5는 매 호출마다 `maxSynced=남은예산`을 넘기며, 백엔드 응답의 `attempted`로 집계
- `complete=false`이면 해당 시·도는 완료 처리하지 않고 다음 날 `--skip-done`으로 이어감

## SQL 검증 예시

```sql
-- 시·도(주소)별 병원 수
SELECT
  CASE
    WHEN address LIKE '서울%' THEN '서울'
    WHEN address LIKE '부산%' THEN '부산'
    WHEN address LIKE '대구%' THEN '대구'
    WHEN address LIKE '인천%' THEN '인천'
    WHEN address LIKE '광주%' THEN '광주'
    WHEN address LIKE '대전%' THEN '대전'
    WHEN address LIKE '울산%' THEN '울산'
    WHEN address LIKE '세종%' THEN '세종'
    WHEN address LIKE '경기%' THEN '경기'
    WHEN address LIKE '강원%' THEN '강원'
    WHEN address LIKE '충북%' OR address LIKE '충청북%' THEN '충북'
    WHEN address LIKE '충남%' OR address LIKE '충청남%' THEN '충남'
    WHEN address LIKE '전북%' OR address LIKE '전라북%' THEN '전북'
    WHEN address LIKE '전남%' OR address LIKE '전라남%' THEN '전남'
    WHEN address LIKE '경북%' OR address LIKE '경상북%' THEN '경북'
    WHEN address LIKE '경남%' OR address LIKE '경상남%' THEN '경남'
    WHEN address LIKE '제주%' THEN '제주'
    ELSE '기타'
  END AS sido,
  COUNT(*) AS cnt
FROM hospital
GROUP BY 1
ORDER BY cnt DESC;

-- 좌표 없는 병원
SELECT COUNT(*) FROM hospital WHERE latitude IS NULL OR longitude IS NULL;

-- 최근 동기화(업데이트) 시각이 있는 경우
SELECT MAX(updated_at) FROM hospital;
```

테이블/컬럼명은 실제 스키마에 맞게 조정하세요.

import type { HospitalEvaluationSummary } from '@/types'

/** getHospAsmInfo1 응답 필드 순서 (API 명세 기준) */
export const EVAL_GRADE_KEYS = [
  'asmGrd01',
  'asmGrd03',
  'asmGrd04',
  'asmGrd05',
  'asmGrd06',
  'asmGrd07',
  'asmGrd08',
  'asmGrd09',
  'asmGrd10',
  'asmGrd12',
  'asmGrd13',
  'asmGrd14',
  'asmGrd15',
  'asmGrd16',
  'asmGrd17',
  'asmGrd18',
  'asmGrd19',
  'asmGrd20',
  'asmGrd21',
  'asmGrd22',
  'asmGrd23',
  'asmGrd24',
] as const satisfies readonly (keyof HospitalEvaluationSummary)[]

/** 항목별 표시명 (심평원 병원평가정보 항목 요약) */
export const HIRA_EVAL_LABELS: Record<(typeof EVAL_GRADE_KEYS)[number], string> = {
  asmGrd01: '응급의료 중증도 분류',
  asmGrd03: '중증외상 진료',
  asmGrd04: '뇌졸중 진료',
  asmGrd05: '급성심근경색 진료',
  asmGrd06: '폐렴 진료',
  asmGrd07: '위·대장 내시경',
  asmGrd08: '대장암 수술',
  asmGrd09: '폐암 수술',
  asmGrd10: '유방암 수술',
  asmGrd12: '담낭·담도 수술',
  asmGrd13: '난임 시술',
  asmGrd14: '심폐뇌소생술',
  asmGrd15: '관상동맥우회술',
  asmGrd16: '요양병원 적정성',
  asmGrd17: '중환자실',
  asmGrd18: '약품 처방',
  asmGrd19: '주사제 처방',
  asmGrd20: '수술부위 감염 예방 항생제',
  asmGrd21: '만성폐쇄성폐질환',
  asmGrd22: '천식',
  asmGrd23: '당뇨병',
  asmGrd24: '고혈압',
}

function parseGrade(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = parseInt(String(value).trim(), 10)
  return n >= 1 && n <= 5 ? n : null
}

/**
 * 유효 숫자 등급(1~5)만 모아 산술 평균 후 반올림. 없으면 null.
 * 심평원 항목은 보통 1등급이 가장 우수·5등급이 가장 열위이므로, 값이 작을수록 우수합니다.
 */
export function getEvaluationStarScore(
  evaluation: HospitalEvaluationSummary | null | undefined
): number | null {
  if (!evaluation) return null
  const grades: number[] = []
  for (const key of EVAL_GRADE_KEYS) {
    const v = evaluation[key]
    const g = parseGrade(typeof v === 'string' ? v : null)
    if (g != null) grades.push(g)
  }
  if (grades.length === 0) return null
  const sum = grades.reduce((a, b) => a + b, 0)
  return Math.round(sum / grades.length)
}

/**
 * 등급 평균(1=우수 … 5=열위)을 일반적인 "별 많을수록 좋음" UI로 변환.
 * 예: 평균 1 → 5칸, 평균 5 → 1칸.
 */
export function getHiraGradeAverageAsStarFill(gradeAverage: number): number {
  const g = Math.min(5, Math.max(1, Math.round(gradeAverage)))
  return Math.min(5, Math.max(1, 6 - g))
}

/** 세부 등급 값이 있는 항목 개수(`getHiraEvaluationRows`와 동일 조건, 배열 생성 없음) */
export function countHiraEvaluationEntries(
  evaluation: HospitalEvaluationSummary | null | undefined
): number {
  if (!evaluation) return 0
  let n = 0
  for (const key of EVAL_GRADE_KEYS) {
    const raw = evaluation[key]
    if (raw != null && String(raw).trim() !== '') n++
  }
  return n
}

export type HiraEvalRow = { key: string; label: string; value: string }

/** 숫자 등급(1=우수) 오름차순. 비숫자(등급제외 등)는 뒤로 */
function gradeSortKey(value: string): number {
  const n = parseInt(value.trim(), 10)
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 99
}

export function getHiraEvaluationRows(
  evaluation: HospitalEvaluationSummary
): HiraEvalRow[] {
  const rows: HiraEvalRow[] = []
  for (const key of EVAL_GRADE_KEYS) {
    const raw = evaluation[key]
    if (raw == null || String(raw).trim() === '') continue
    rows.push({
      key,
      label: HIRA_EVAL_LABELS[key],
      value: String(raw).trim(),
    })
  }
  rows.sort((a, b) => {
    const diff = gradeSortKey(a.value) - gradeSortKey(b.value)
    if (diff !== 0) return diff
    return a.label.localeCompare(b.label, 'ko')
  })
  return rows
}

import type { HospitalEvaluationSummary } from '../types/hospital'

/** getHospAsmInfo1 응답 필드 순서 */
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

/** 항목별 표시명 (심평원 병원평가정보) */
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
 * 유효 숫자 등급(1~5) 산술 평균(반올림). 없으면 null.
 * 심평원은 보통 1등급이 가장 우수.
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
  return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
}

/** 등급 평균(1=우수) → 별 채움(많을수록 좋음) */
export function getHiraGradeAverageAsStarFill(gradeAverage: number): number {
  const g = Math.min(5, Math.max(1, Math.round(gradeAverage)))
  return Math.min(5, Math.max(1, 6 - g))
}

export type HiraEvalRow = { key: string; label: string; value: string }

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
  return rows
}

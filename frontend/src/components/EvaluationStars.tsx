import type { HospitalEvaluationSummary } from '../types/hospital'
import {
  getEvaluationStarScore,
  getHiraGradeAverageAsStarFill,
} from '../lib/hiraEvaluation'

export { getEvaluationStarScore } from '../lib/hiraEvaluation'

interface EvaluationStarsProps {
  /** 1~5. 심평원 등급 평균이면 invertHiraGrade로 별 채움을 변환 */
  score: number | null
  max?: number
  size?: 'sm' | 'md' | 'lg'
  /** 사용자 리뷰(amber) vs 심평원(sky) */
  tone?: 'review' | 'hira'
  /** true면 심평원 등급(1=우수)을 별 개수로 뒤집음 */
  invertHiraGrade?: boolean
  className?: string
}

const sizeClass = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
}

const toneClass = {
  review: 'text-amber-500',
  hira: 'text-sky-600',
}

/** 점수를 별(★/☆)로 표시 */
export function EvaluationStars({
  score,
  max = 5,
  size = 'md',
  tone = 'hira',
  invertHiraGrade = false,
  className = '',
}: EvaluationStarsProps) {
  if (score == null || score < 0 || score > max) return null

  const filled = Math.min(
    max,
    Math.max(
      0,
      Math.round(invertHiraGrade ? getHiraGradeAverageAsStarFill(score) : score)
    )
  )
  const empty = max - filled
  const color = className.includes('text-') ? '' : toneClass[tone]

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${sizeClass[size]} ${color} ${className}`}
      role="img"
      aria-label={
        tone === 'hira'
          ? `심평원 평가 별 ${filled}개`
          : `사용자 평가 ${filled}점`
      }
    >
      {'★'.repeat(filled)}
      {'☆'.repeat(empty)}
    </span>
  )
}

/** 평가 객체에서 심평원 별 표시용 점수(등급 평균) */
export function getHiraStarDisplayScore(
  evaluation: HospitalEvaluationSummary | null | undefined
): number | null {
  return getEvaluationStarScore(evaluation)
}

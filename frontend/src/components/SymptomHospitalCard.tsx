import type { Hospital, NearbyHospital } from '../types/hospital'
import { EvaluationStars, getEvaluationStarScore } from './EvaluationStars'
import { HIRA_ATTR_SHORT } from '../lib/hiraAttribution'

function countHiraEntries(evaluation: Hospital['evaluation']): number {
  if (!evaluation) return 0
  let n = 0
  for (const [key, value] of Object.entries(evaluation)) {
    if (!key.startsWith('asmGrd') || typeof value !== 'string') continue
    const grade = parseInt(value.trim(), 10)
    if (grade >= 1 && grade <= 5) n += 1
  }
  return n
}

type SymptomHospitalCardProps = {
  item: NearbyHospital
  onClick?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

/** Expo HospitalCard와 동일한 정보 구조의 증상별 병원 카드 */
export function SymptomHospitalCard({
  item,
  onClick,
  isFavorite,
  onToggleFavorite,
}: SymptomHospitalCardProps) {
  const h = item.hospital
  const hiraScore = getEvaluationStarScore(h.evaluation ?? undefined)
  const hiraCount = countHiraEntries(h.evaluation)
  const showHira = h.evaluation != null && (hiraScore != null || hiraCount > 0)
  const topDiseases = [
    h.top5?.diseaseNm1,
    h.top5?.diseaseNm2,
    h.top5?.diseaseNm3,
  ].filter(Boolean) as string[]

  return (
    <div
      className="w-full rounded-xl border border-slate-200 bg-white p-4 mb-3 hover:border-sky-300 hover:bg-sky-50/40 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex px-2 py-0.5 rounded bg-sky-100 text-xs font-semibold text-sky-700">
          {h.department ?? '일반'}
        </span>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-base"
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
      </div>

      <div className="font-bold text-slate-800 text-base truncate">{h.name}</div>
      <div className="text-sm text-slate-500 truncate mt-0.5">{h.address ?? '-'}</div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 text-slate-800">
          <span className="text-amber-400" aria-hidden>
            ★
          </span>
          <span className="font-semibold">{h.averageRating?.toFixed(1) ?? '-'}</span>
          <span className="text-slate-400 text-xs">({h.reviewCount ?? 0})</span>
        </span>
        {h.doctorTotalCount != null && h.doctorTotalCount > 0 && (
          <span className="text-xs text-slate-500">의사 {h.doctorTotalCount}명</span>
        )}
      </div>

      {showHira && (
        <div className="mt-2 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-sky-700">심평원</span>
            {hiraScore != null ? (
              <>
                <EvaluationStars score={hiraScore} size="sm" className="text-sky-600" />
                <span className="text-slate-500">등급 평균 {hiraScore} (1이 우수)</span>
              </>
            ) : (
              <span className="text-slate-600 font-medium">등급 {hiraCount}항목</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">{HIRA_ATTR_SHORT}</span>
        </div>
      )}

      {topDiseases.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {topDiseases.map((disease) => (
            <span
              key={disease}
              className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-600"
            >
              {disease}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

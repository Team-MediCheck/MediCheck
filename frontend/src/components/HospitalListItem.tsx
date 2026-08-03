import type React from 'react'
import type { Hospital, NearbyHospital } from '../types/hospital'
import { formatDistance } from '../utils/format'
import { EvaluationStars, getEvaluationStarScore } from './EvaluationStars'

function doctorSummary(h: Hospital): string | null {
  const total = h.doctorTotalCount ?? 0
  const specialist =
    (h.mdeptSpecialistCount ?? 0) +
    (h.detySpecialistCount ?? 0) +
    (h.cmdcSpecialistCount ?? 0)
  if (total === 0) return null
  if (specialist > 0) return `의사 ${total}명 · 전문의 ${specialist}명`
  return `의사 ${total}명`
}

interface HospitalListItemProps {
  item: NearbyHospital
  onClick?: () => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
  showDistance?: boolean
}

export function HospitalListItem({
  item,
  onClick,
  isFavorite,
  onToggleFavorite,
  showDistance = true,
}: HospitalListItemProps) {
  const h = item.hospital
  const hasEvaluation = !!h.evaluation
  const evaluationScore = getEvaluationStarScore(h.evaluation ?? undefined)
  return (
    <div
      className="w-full px-4 py-3 rounded-xl hover:bg-sky-50 active:bg-sky-100 transition-colors border border-transparent hover:border-sky-100 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-800 text-sm truncate">{h.name}</div>
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-lg flex-shrink-0"
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
        <span className="truncate mr-2 flex items-center gap-1.5">
          {h.department ?? '-'}
          {hasEvaluation && evaluationScore != null && (
            <span className="flex-shrink-0">
              <EvaluationStars
                score={evaluationScore}
                size="sm"
                tone="hira"
                invertHiraGrade
              />
            </span>
          )}
          {hasEvaluation && evaluationScore == null && (
            <span className="text-[10px] text-sky-700 flex-shrink-0">★ 평가정보</span>
          )}
        </span>
        <span className="text-sky-600 font-medium flex-shrink-0">
          {showDistance && item.distanceMeters > 0 ? formatDistance(item.distanceMeters) : null}
        </span>
      </div>
      {(h.averageRating != null && (h.reviewCount ?? 0) > 0) && (
        <div className="text-xs text-amber-600 mt-0.5">
          ★ {h.averageRating.toFixed(1)} (리뷰 {h.reviewCount}개)
        </div>
      )}
      {doctorSummary(h) && (
        <div className="text-xs text-gray-500 mt-0.5">{doctorSummary(h)}</div>
      )}
      {h.address && (
        <div className="text-xs text-gray-400 truncate mt-0.5">{h.address}</div>
      )}
    </div>
  )
}

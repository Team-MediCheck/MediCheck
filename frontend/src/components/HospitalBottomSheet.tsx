import type { NearbyHospital } from '../types/hospital'
import { formatDistance, formatDate } from '../utils/format'
import { EvaluationStars, getEvaluationStarScore } from './EvaluationStars'
import { getHiraEvaluationRows } from '../lib/hiraEvaluation'
import { HIRA_ATTR_BASIS, HIRA_ATTR_SHORT } from '../lib/hiraAttribution'

interface HospitalBottomSheetProps {
  item: NearbyHospital
  onClose: () => void
  onOpenReviews: (hospitalId: number) => void
  isFavorite?: boolean
  onToggleFavorite?: () => void
}

/** 카카오맵 앱/웹 목적지 길찾기 URL */
function kakaoMapDirectionsUrl(lat: number, lng: number, name: string): string {
  const encName = encodeURIComponent(name)
  return `https://map.kakao.com/link/to/${encName},${lat},${lng}`
}

/** 네이버 지도 웹에서 장소 검색 (브라우저에서 바로 열림) */
function naverMapSearchUrl(name: string, address: string | null): string {
  const query = [name, address].filter(Boolean).join(' ')
  return `https://map.naver.com/v5/search/${encodeURIComponent(query)}`
}

function doctorSummary(h: NearbyHospital['hospital']): string | null {
  const total = h.doctorTotalCount ?? 0
  const specialist =
    (h.mdeptSpecialistCount ?? 0) +
    (h.detySpecialistCount ?? 0) +
    (h.cmdcSpecialistCount ?? 0)
  if (total === 0) return null
  if (specialist > 0) return `의사 ${total}명 · 전문의 ${specialist}명`
  return `의사 ${total}명`
}

export function HospitalBottomSheet({
  item,
  onClose,
  onOpenReviews,
  isFavorite,
  onToggleFavorite,
}: HospitalBottomSheetProps) {
  const h = item.hospital
  const lat = h.latitude ?? 0
  const lng = h.longitude ?? 0
  const hasDirections = lat !== 0 && lng !== 0
  const reviewText =
    h.reviewCount != null && h.reviewCount > 0
      ? `리뷰 ${h.reviewCount}개`
      : null
  const hasEvaluation = !!h.evaluation
  const evaluationScore = getEvaluationStarScore(h.evaluation ?? undefined)
  const evaluationRows = h.evaluation ? getHiraEvaluationRows(h.evaluation) : []
  const top5 = h.top5
  const top5Diseases = top5
    ? [top5.diseaseNm1, top5.diseaseNm2, top5.diseaseNm3, top5.diseaseNm4, top5.diseaseNm5].filter(
        (d): d is string => !!d && d.trim().length > 0
      )
    : []
  const hasTop5 = top5Diseases.length > 0
  const typeParts = [h.department]
  if (hasEvaluation) typeParts.push('심평원 평가정보')
  if (hasTop5) typeParts.push('진료 Top5')
  if (reviewText) typeParts.push(reviewText)
  const typeAndReview = typeParts.filter(Boolean).join(' · ') || '병원'

  return (
    <>
      <div
        className="fixed inset-0 top-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl bg-gray-900 text-white shadow-2xl safe-area-pb max-h-[85vh] flex flex-col sheet-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hospital-sheet-title"
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" aria-hidden />
        </div>

        {/* 헤더: 이름 + 즐겨찾기 + 닫기 */}
        <div className="flex items-start gap-3 px-4 pb-3">
          <h2
            id="hospital-sheet-title"
            className="flex-1 min-w-0 text-lg font-bold leading-snug break-words"
          >
            {h.name}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={onToggleFavorite}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-xl"
                aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-white/10 text-gray-300"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 부제: 심평원 별점 + 타입 · 리뷰 / 거리 · 지역 */}
        <div className="px-4 pb-3 text-sm text-gray-300 space-y-1">
          {evaluationScore != null && (
            <div className="flex items-center gap-2">
              <EvaluationStars
                score={evaluationScore}
                size="lg"
                tone="hira"
                invertHiraGrade
                className="text-sky-400"
              />
              <span className="text-gray-400 text-xs">심평원 평가</span>
            </div>
          )}
          <div>
            <span>{typeAndReview}</span>
            <span className="mx-2">·</span>
            <span>{formatDistance(item.distanceMeters)}</span>
            {h.address && (
              <>
                <span className="mx-2">·</span>
                <span className="truncate block mt-0.5">{h.address}</span>
              </>
            )}
          </div>
        </div>

        {/* 액션 버튼: 길찾기(지도 앱) + 리뷰 보기 */}
        <div className="px-4 pb-3 space-y-2">
          {hasDirections && (
            <div className="flex gap-2">
              <a
                href={kakaoMapDirectionsUrl(lat, lng, h.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] rounded-xl bg-sky-500 hover:bg-sky-600 font-medium text-sm text-white flex items-center justify-center"
              >
                카카오맵
              </a>
              <a
                href={naverMapSearchUrl(h.name, h.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] rounded-xl border border-gray-600 hover:bg-gray-800 font-medium text-sm text-white flex items-center justify-center"
              >
                네이버 지도
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={() => onOpenReviews(h.id)}
            className="w-full min-h-[44px] rounded-xl bg-gray-700 hover:bg-gray-600 font-medium text-sm text-white"
          >
            리뷰 보기
          </button>
        </div>

        {/* 상세 정보 (흰 배경) */}
        <div className="flex-1 overflow-y-auto rounded-t-2xl bg-white text-gray-700 px-4 py-4">
          {h.phone && (
            <div className="flex items-center gap-2 py-2 border-b border-gray-100">
              <span className="text-gray-400" aria-hidden>📞</span>
              <a
                href={`tel:${h.phone.replace(/-/g, '')}`}
                className="text-sky-600 font-medium"
              >
                {h.phone}
              </a>
            </div>
          )}
          {h.address && (
            <div className="flex items-start gap-2 py-2 border-b border-gray-100">
              <span className="text-gray-400 shrink-0" aria-hidden>📍</span>
              <span className="text-sm break-words">{h.address}</span>
            </div>
          )}
          {doctorSummary(h) && (
            <div className="flex items-center gap-2 py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-400" aria-hidden>👨‍⚕️</span>
              <span>{doctorSummary(h)}</span>
            </div>
          )}
          {h.establishedDate && (
            <div className="flex items-center gap-2 py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-400" aria-hidden>📅</span>
              <span>{formatDate(h.establishedDate)}</span>
            </div>
          )}
          {hasEvaluation && (
            <div className="py-3 border-b border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                {evaluationScore != null ? (
                  <EvaluationStars
                    score={evaluationScore}
                    size="md"
                    tone="hira"
                    invertHiraGrade
                  />
                ) : null}
                <span className="text-sm font-medium text-sky-700">심평원 평가</span>
              </div>
              <p className="text-[11px] text-gray-400">{HIRA_ATTR_SHORT} · 병원평가정보</p>
              {evaluationRows.length > 0 ? (
                <ul className="rounded-xl border border-sky-100 bg-sky-50/60 divide-y divide-sky-100 overflow-hidden">
                  {evaluationRows.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-700 min-w-0">{row.label}</span>
                      <span className="shrink-0 font-semibold text-sky-800 tabular-nums">
                        {/^\d+$/.test(row.value) ? `${row.value}등급` : row.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-700">
                  심평원 병원평가정보가 있는 병원입니다.
                </p>
              )}
            </div>
          )}
          <div className="pt-2 space-y-1">
            {hasTop5 && (
              <div className="pt-2">
                <div className="text-xs font-medium text-gray-700 mb-1">
                  심평원 진료 Top5
                  {top5?.crtrYm ? (
                    <span className="text-xs text-gray-400 ml-2">기준 {top5.crtrYm}</span>
                  ) : null}
                </div>
                <p className="text-[11px] text-gray-400 mb-1.5">{HIRA_ATTR_SHORT} · 병원진료정보조회서비스</p>
                <div className="flex flex-wrap gap-2">
                  {top5Diseases.map((d, idx) => (
                    <span
                      key={`${d}-${idx}`}
                      className="inline-flex items-center px-2 py-1 rounded-lg border border-sky-100 bg-sky-50 text-sky-700 text-xs font-medium"
                    >
                      {idx + 1}. {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(hasEvaluation || hasTop5) && (
              <p className="text-[11px] text-gray-400 leading-relaxed pt-2 border-t border-gray-100 mt-2">
                {HIRA_ATTR_BASIS}
              </p>
            )}
            <p className="text-xs text-gray-400">
              ※ 진료 시간은 병원에 문의해 주세요
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

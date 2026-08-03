import { useEffect, useRef, useState } from 'react'
import type { NearbyHospital } from '../types/hospital'
import { formatDate } from '../utils/format'
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

const DISMISS_DISTANCE = 96
const DISMISS_VELOCITY = 0.55

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

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button, a, input, textarea, select, label'))
}

export function HospitalBottomSheet({
  item,
  onClose,
  onOpenReviews,
  isFavorite,
  onToggleFavorite,
}: HospitalBottomSheetProps) {
  const h = item.hospital
  const [evalOpen, setEvalOpen] = useState(false)
  const [basisOpen, setBasisOpen] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)

  const dragState = useRef<{
    pointerId: number
    startY: number
    lastY: number
    lastT: number
    armed: boolean
  } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setEvalOpen(false)
    setBasisOpen(false)
    setDragY(0)
    setDragging(false)
    setClosing(false)
    dragState.current = null
  }, [h.id])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return

    const onMove = (e: TouchEvent) => {
      const state = dragState.current
      if (!state || state.pointerId !== -1 || !state.armed) return
      if (e.cancelable) e.preventDefault()
    }

    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [])

  const finishClose = () => {
    setClosing(true)
    setDragY(typeof window !== 'undefined' ? window.innerHeight : 800)
    window.setTimeout(() => onCloseRef.current(), 180)
  }

  const endDrag = (clientY: number) => {
    const state = dragState.current
    dragState.current = null
    setDragging(false)
    if (!state) return

    const dy = Math.max(0, clientY - state.startY)
    const dt = Math.max(1, Date.now() - state.lastT)
    const velocity = Math.max(0, (clientY - state.lastY) / dt)

    if (dy >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY) {
      finishClose()
      return
    }
    setDragY(0)
  }

  const onDragPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (closing || e.button !== 0) return
    if (isInteractiveTarget(e.target)) return
    dragState.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: Date.now(),
      armed: true,
    }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onDragPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId || !state.armed) return
    const dy = Math.max(0, e.clientY - state.startY)
    state.lastY = e.clientY
    state.lastT = Date.now()
    setDragY(dy)
  }

  const onDragPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    endDrag(e.clientY)
  }

  /** 흰 영역이 맨 위일 때 아래로 당기면 시트 닫기 */
  const onBodyTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (closing || e.touches.length !== 1) return
    if (isInteractiveTarget(e.target)) return
    const el = bodyRef.current
    if (!el || el.scrollTop > 0) return
    const t = e.touches[0]
    dragState.current = {
      pointerId: -1,
      startY: t.clientY,
      lastY: t.clientY,
      lastT: Date.now(),
      armed: false,
    }
  }

  const onBodyTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== -1) return
    const el = bodyRef.current
    if (!el) return
    const t = e.touches[0]
    const dy = t.clientY - state.startY

    if (!state.armed) {
      if (el.scrollTop > 0 || dy <= 8) return
      state.armed = true
      setDragging(true)
    }

    if (!state.armed) return
    e.preventDefault()
    state.lastY = t.clientY
    state.lastT = Date.now()
    setDragY(Math.max(0, dy))
  }

  const onBodyTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== -1) return
    const y = e.changedTouches[0]?.clientY ?? state.lastY
    if (!state.armed) {
      dragState.current = null
      return
    }
    endDrag(y)
  }

  const lat = h.latitude ?? 0
  const lng = h.longitude ?? 0
  const hasDirections = lat !== 0 && lng !== 0
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
  const backdropOpacity = Math.max(0.12, 0.4 * (1 - dragY / 320))
  const sheetTransition =
    dragging || closing ? 'none' : 'transform 0.22s ease-out'
  const sheetTransform = `translateY(${dragY}px)`

  return (
    <>
      <div
        className="fixed inset-0 top-0 z-40 bg-black/40"
        style={{ opacity: backdropOpacity }}
        onClick={closing ? undefined : onClose}
        aria-hidden
      />
      <div
        className={`fixed left-0 right-0 bottom-0 z-50 flex max-h-[min(85dvh,85vh)] flex-col overflow-hidden rounded-t-2xl bg-gray-900 text-white shadow-2xl safe-area-pb ${
          dragging || closing || dragY > 0 ? '' : 'sheet-slide-up'
        }`}
        style={{ transform: sheetTransform, transition: sheetTransition }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hospital-sheet-title"
      >
        {/* 드래그 영역: 핸들 + 헤더 + 별점 */}
        <div
          className="shrink-0 touch-none select-none"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div
              className="w-12 h-1.5 rounded-full bg-gray-500"
              aria-hidden
            />
          </div>
          <p className="sr-only">아래로 쓸어내려 닫기</p>

          <div className="flex items-start gap-3 px-4 pb-2">
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

          <div className="px-4 pb-2 text-sm text-gray-300">
            {(h.averageRating != null && (h.reviewCount ?? 0) > 0) ||
            evaluationScore != null ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {h.averageRating != null && (h.reviewCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-amber-400/90 text-xs font-semibold">
                      사용자
                    </span>
                    <EvaluationStars
                      score={Math.round(h.averageRating)}
                      size="lg"
                      tone="review"
                      className="text-amber-400"
                    />
                    <span className="text-amber-300/80 text-xs tabular-nums">
                      {h.averageRating.toFixed(1)}
                    </span>
                  </span>
                )}
                {evaluationScore != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sky-400/90 text-xs font-semibold">
                      심평원
                    </span>
                    <EvaluationStars
                      score={evaluationScore}
                      size="lg"
                      tone="hira"
                      invertHiraGrade
                      className="text-sky-400"
                    />
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* 액션 버튼: 길찾기(지도 앱) + 리뷰 보기 */}
        <div className="shrink-0 px-4 pb-3 space-y-2">
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

        {/* 상세 정보 (흰 배경) — 맨 위에서 아래로 당기면 닫힘 */}
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-t-2xl bg-white text-gray-700 px-4 py-4 [-webkit-overflow-scrolling:touch]"
          onTouchStart={onBodyTouchStart}
          onTouchMove={onBodyTouchMove}
          onTouchEnd={onBodyTouchEnd}
          onTouchCancel={onBodyTouchEnd}
        >
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
                <>
                  <button
                    type="button"
                    onClick={() => setEvalOpen((v) => !v)}
                    className="w-full min-h-[40px] flex items-center justify-between gap-2 px-3 rounded-xl border border-sky-100 bg-sky-50 text-sm font-medium text-sky-800"
                    aria-expanded={evalOpen}
                  >
                    <span>평가 항목 {evaluationRows.length}개</span>
                    <span className="text-sky-600" aria-hidden>
                      {evalOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {evalOpen && (
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
                  )}
                </>
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
              <div className="pt-2 border-t border-gray-100 mt-2">
                <button
                  type="button"
                  onClick={() => setBasisOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left text-[11px] text-gray-500 py-1"
                  aria-expanded={basisOpen}
                >
                  <span>데이터 출처·평가 근거</span>
                  <span aria-hidden>{basisOpen ? '▲' : '▼'}</span>
                </button>
                {basisOpen && (
                  <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                    {HIRA_ATTR_BASIS}
                  </p>
                )}
              </div>
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

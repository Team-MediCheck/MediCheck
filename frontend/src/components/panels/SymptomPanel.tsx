import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchHospitalsBySymptom, fetchSymptomPickerKeywords } from '../../api/hospitals'
import { SymptomHospitalCard } from '../SymptomHospitalCard'
import { useFavorites } from '../../hooks/useFavorites'
import { useGeolocation } from '../../hooks/useGeolocation'
import { SYMPTOM_PICKER_LABELS } from '../../lib/symptomPickerLabels'
import type { Hospital, NearbyHospital } from '../../types/hospital'
import { HIRA_ATTR_SHORT } from '../../lib/hiraAttribution'

const PAGE_SIZE = 20
/** 매 effect 실행마다 `[]` 리터럴을 넘기면 부모 setState 루프(React #185)가 날 수 있음 */
const EMPTY_NEARBY: NearbyHospital[] = []

function toNearbyItem(h: Hospital): NearbyHospital {
  return { hospital: h, distanceMeters: 0 }
}

function userFacingQueryErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('서버 응답이 없습니다')) return err.message
    if (err.message.startsWith('API Error') || err.message.includes('Failed to fetch')) {
      return '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    }
    return err.message
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

type SymptomPanelProps = {
  onHospitalsChange?: (hospitals: NearbyHospital[]) => void
  onHospitalClick?: (item: NearbyHospital) => void
}

export function SymptomPanel({ onHospitalsChange, onHospitalClick }: SymptomPanelProps) {
  const [symptom, setSymptom] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState('')
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { latitude, longitude } = useGeolocation()
  const { favoriteIds, toggleFavorite, isLoggedIn } = useFavorites()

  useEffect(() => {
    if (pickerOpen) setPickerFilter('')
  }, [pickerOpen])

  const { data: serverKeywords } = useQuery({
    queryKey: ['symptomPickerKeywords'],
    queryFn: fetchSymptomPickerKeywords,
    staleTime: 10 * 60 * 1000,
  })

  const pickerKeywords = useMemo(() => {
    if (Array.isArray(serverKeywords) && serverKeywords.length > 0) {
      return serverKeywords
    }
    return SYMPTOM_PICKER_LABELS
  }, [serverKeywords])

  const filteredKeywords = useMemo(() => {
    const q = pickerFilter.trim().toLowerCase()
    if (!q) return pickerKeywords
    return pickerKeywords.filter((k) => k.toLowerCase().includes(q))
  }, [pickerKeywords, pickerFilter])

  const symptomTrim = symptom.trim()
  const symptomReady = symptomTrim.length >= 2
  const hasCoords = latitude != null && longitude != null

  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    error,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'hospitalsBySymptom',
      symptomTrim,
      hasCoords ? `${latitude},${longitude}` : 'no-coords',
    ],
    queryFn: ({ pageParam }) =>
      fetchHospitalsBySymptom({
        symptom: symptomTrim,
        lat: latitude ?? undefined,
        lng: longitude ?? undefined,
        page: pageParam,
        size: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
    enabled: symptomReady,
  })

  const hospitals = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.content) ?? []
    const seen = new Set<number>()
    return all.filter((h) => {
      if (seen.has(h.id)) return false
      seen.add(h.id)
      return true
    })
  }, [data])

  const totalHits = data?.pages[0]?.totalElements ?? 0
  const nearbyItems = useMemo(() => hospitals.map((h) => toNearbyItem(h)), [hospitals])
  const listLoading = isLoading && !data
  const showFullScreenLoadError = isError && !data
  const loadErrorMessage = error ? userFacingQueryErrorMessage(error) : ''

  useEffect(() => {
    onHospitalsChange?.(symptomReady ? nearbyItems : EMPTY_NEARBY)
  }, [nearbyItems, onHospitalsChange, symptomReady])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleToggleFavorite = async (hospitalId: number) => {
    try {
      await toggleFavorite(hospitalId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '즐겨찾기 처리 중 오류가 발생했습니다.')
    }
  }

  const handlePickSymptom = (label: string) => {
    setSymptom(label)
    setPickerOpen(false)
    setPickerFilter('')
  }

  const resultLabel = !symptomReady
    ? '증상을 선택해 주세요'
    : listLoading
      ? '검색 중…'
      : showFullScreenLoadError
        ? '검색을 불러오지 못했습니다. 아래에서 다시 시도해 주세요.'
        : totalHits > 0
          ? `검색 결과 ${totalHits}건`
          : '검색 결과 0건'

  return (
    <>
      <div className="px-4 pt-3 pb-2.5 border-b border-slate-200 bg-white shrink-0 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sky-500 text-lg" aria-hidden>
            ✚
          </span>
          <h2 className="text-[17px] font-bold text-slate-800">증상별 병원찾기</h2>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-between gap-2.5 px-3.5 py-3.5 rounded-[14px] border border-sky-200 bg-sky-50 text-left hover:border-sky-300 transition-colors"
          aria-label="증상·질환 목록 열기"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-sky-700 tracking-wide mb-1">선택</span>
            <span
              className={`block text-base font-semibold leading-snug ${
                symptomTrim ? 'text-slate-900' : 'text-slate-500 font-medium'
              }`}
            >
              {symptomTrim || '탭하여 DB에 있는 질병명 목록 열기'}
            </span>
          </span>
          <span className="text-slate-500 text-lg shrink-0" aria-hidden>
            ▾
          </span>
        </button>

        {symptomTrim ? (
          <button
            type="button"
            onClick={() => setSymptom('')}
            className="text-sm font-semibold text-sky-500 hover:text-sky-600"
            aria-label="선택한 증상 해제"
          >
            선택 해제
          </button>
        ) : null}

        <p className="text-xs text-slate-500 leading-relaxed">
          항목을 고르면 해당 질병명과 부분 일치하는 병원만 검색됩니다. 매칭 순위(1위→5위)가 높은
          병원이 먼저 나옵니다.
          {hasCoords
            ? ' 같은 순위는 현재 위치 기준 가까운 순입니다.'
            : ' 위치 권한을 허용하면 같은 순위를 가까운 순으로 정렬합니다.'}{' '}
          ({HIRA_ATTR_SHORT} · 병원진료정보 Top5)
        </p>
      </div>

      <div className="px-4 py-3 shrink-0">
        <p className="text-sm text-slate-500">{resultLabel}</p>
      </div>

      <div className="px-4 pb-4 flex-1 min-h-0 overflow-y-auto">
        {!symptomReady ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="text-4xl text-slate-300" aria-hidden>
              ☰
            </div>
            <div className="text-lg font-bold text-slate-700">병원 목록이 여기에 표시됩니다</div>
            <p className="text-[15px] text-slate-400 leading-relaxed">
              위「선택」을 눌러 실제 데이터에 있는 질병명을 고르세요.
            </p>
          </div>
        ) : listLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : showFullScreenLoadError ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="text-amber-500 font-medium">⚠</div>
            <p className="text-[15px] text-slate-400 leading-relaxed">{loadErrorMessage}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sky-500 font-semibold text-[15px]"
            >
              다시 시도
            </button>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="text-4xl text-slate-300" aria-hidden>
              ⌕
            </div>
            <p className="text-[15px] text-slate-400">조건에 맞는 병원이 없습니다</p>
          </div>
        ) : (
          <>
            {hospitals.map((h) => {
              const item = toNearbyItem(h)
              return (
                <SymptomHospitalCard
                  key={h.id}
                  item={item}
                  onClick={onHospitalClick ? () => onHospitalClick(item) : undefined}
                  isFavorite={favoriteIds.has(h.id)}
                  onToggleFavorite={isLoggedIn ? () => handleToggleFavorite(h.id) : undefined}
                />
              )
            })}
            <div ref={loadMoreRef} className="h-10 flex flex-col items-center justify-center gap-2">
              {isFetchingNextPage && (
                <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              )}
              {isFetchNextPageError && (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 mb-1">추가 목록을 불러오지 못했습니다.</p>
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    className="text-sm font-semibold text-sky-500"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45"
          onClick={() => setPickerOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[88vh] min-h-[360px] bg-white rounded-t-[18px] shadow-xl flex flex-col px-4 pt-2 pb-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="질병명 선택"
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-slate-300 mb-3" aria-hidden />
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-lg font-bold text-slate-900">질병명 선택</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-500 text-2xl"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              서버에 동기화된 질병명을 우선 표시합니다. 불러오지 못하면 앱에 포함된 목록을
              사용합니다. 아래에서 검색할 수 있습니다.
            </p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 mb-2.5">
              <span className="text-slate-400 text-sm" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                placeholder="목록에서 찾기…"
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                className="flex-1 h-11 bg-transparent text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 pb-6">
              {filteredKeywords.length === 0 ? (
                <p className="text-center py-8 text-[15px] text-slate-500 px-3">
                  일치하는 항목이 없습니다.
                </p>
              ) : (
                filteredKeywords.map((label) => {
                  const selected = symptomTrim === label
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handlePickSymptom(label)}
                      className={`w-full flex items-center justify-between gap-2.5 py-3.5 px-1 text-left border-b border-slate-100 ${
                        selected ? 'bg-sky-50 rounded-lg px-3 border-b-0' : ''
                      }`}
                    >
                      <span
                        className={`flex-1 text-base ${
                          selected ? 'text-sky-700 font-bold' : 'text-slate-700 font-medium'
                        }`}
                      >
                        {label}
                      </span>
                      <span className={`text-lg ${selected ? 'text-sky-500' : 'text-slate-300'}`}>
                        {selected ? '✓' : '›'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

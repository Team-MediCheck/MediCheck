import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchHospitalsBySymptom, fetchSymptomPickerKeywords } from '../api/hospitals'
import { HospitalListItem } from '../components/HospitalListItem'
import { useFavorites } from '../hooks/useFavorites'
import { useGeolocation } from '../hooks/useGeolocation'
import { SYMPTOM_PICKER_LABELS } from '../lib/symptomPickerLabels'
import type { Hospital } from '../types/hospital'

const PAGE_SIZE = 20

export function SymptomSearchPage() {
  const [symptom, setSymptom] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerFilter, setPickerFilter] = useState('')
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { latitude, longitude } = useGeolocation()
  const { favoriteIds, toggleFavorite, isLoggedIn } = useFavorites()

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

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'hospitalsBySymptom',
      symptomTrim,
      latitude != null && longitude != null ? `${latitude},${longitude}` : 'no-coords',
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

  const hospitals = useMemo(
    () => data?.pages.flatMap((p) => p.content) ?? [],
    [data]
  )

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

  const toNearbyItem = (h: Hospital) => ({
    hospital: h,
    distanceMeters: 0,
  })

  const handleToggleFavorite = async (hospitalId: number) => {
    try {
      await toggleFavorite(hospitalId)
    } catch (err) {
      alert(err instanceof Error ? err.message : '즐겨찾기 처리 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="p-4 bg-white border-b border-gray-100 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">증상별 병원찾기</h2>
          <p className="text-xs text-gray-500 mt-0.5">HIRA Top5 질병명 기준으로 병원을 찾습니다</p>
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white text-left hover:border-sky-300 transition-colors"
        >
          <span className={symptomTrim ? 'text-gray-800 text-sm' : 'text-gray-400 text-sm'}>
            {symptomTrim || '증상/질환을 선택하세요 (2글자 이상)'}
          </span>
          <span className="text-gray-400 text-sm" aria-hidden>▼</span>
        </button>

        {symptomTrim && (
          <button
            type="button"
            onClick={() => setSymptom('')}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            선택 초기화
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!symptomReady ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            증상을 선택하면 관련 병원 목록이 표시됩니다
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="text-amber-600 font-medium">병원 목록을 불러오지 못했습니다</div>
            <p className="mt-2 text-sm text-gray-500">
              {error instanceof Error ? error.message : '다시 시도해 주세요.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            &apos;{symptomTrim}&apos; 관련 병원이 없습니다
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl mx-auto">
            <div className="px-2 py-1 text-xs text-gray-500">
              총 <span className="font-semibold text-sky-600">{hospitals.length}</span>곳
              {hasNextPage ? ' (더 불러오는 중...)' : ''}
            </div>
            {hospitals.map((h) => (
              <HospitalListItem
                key={h.id}
                item={toNearbyItem(h)}
                showDistance={false}
                isFavorite={favoriteIds.has(h.id)}
                onToggleFavorite={isLoggedIn ? () => handleToggleFavorite(h.id) : undefined}
              />
            ))}
            <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setPickerOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[80vh] bg-white rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="증상 선택"
          >
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">증상/질환 선택</h3>
              <input
                type="search"
                placeholder="키워드로 검색"
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                className="mt-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredKeywords.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">검색 결과가 없습니다</div>
              ) : (
                filteredKeywords.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setSymptom(label)
                      setPickerOpen(false)
                      setPickerFilter('')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm hover:bg-sky-50 ${
                      symptom === label ? 'bg-sky-50 text-sky-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNearbyHospitals } from '../api/hospitals'
import { HospitalMap, type HospitalMapHandle } from '../components/HospitalMap'
import { HospitalBottomSheet } from '../components/HospitalBottomSheet'
import { HospitalListItem } from '../components/HospitalListItem'
import { HospitalReviewModal } from '../components/HospitalReviewModal'
import { useFavorites } from '../hooks/useFavorites'
import { useGeolocation } from '../hooks/useGeolocation'
import { useKakaoMapScript } from '../hooks/useKakaoMapScript'
import { filterNearbyHospitals } from '../lib/hospitalFilters'
import type { NearbyHospital } from '../types/hospital'

const RADIUS_OPTIONS = [
  { value: 1000, label: '1km' },
  { value: 3000, label: '3km' },
  { value: 5000, label: '5km' },
  { value: 10000, label: '10km' },
  // 서비스 최대 반경(50km) — 사실상 구미 전역
  { value: 50000, label: '거리 제한 없음' },
]

export function MapPage() {
  const [radius, setRadius] = useState(3000)
  const [isListOpen, setIsListOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  )
  const [searchKeyword, setSearchKeyword] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const mapRef = useRef<HospitalMapHandle>(null)
  const { favoriteIds, toggleFavorite, isLoggedIn } = useFavorites()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [reviewHospitalId, setReviewHospitalId] = useState<number | null>(null)
  const [selectedHospital, setSelectedHospital] = useState<NearbyHospital | null>(null)
  const openListButtonRef = useRef<HTMLButtonElement>(null)

  const handleClosePopup = useCallback(() => setSelectedHospital(null), [])

  const { loaded: mapLoaded, error: mapError } = useKakaoMapScript()

  // 목록 닫을 때 포커스를 '목록 열기' 버튼으로 옮겨 aria-hidden 경고 방지
  useEffect(() => {
    if (!isListOpen) openListButtonRef.current?.focus({ preventScroll: true })
  }, [isListOpen])
  const { latitude, longitude, loading: geoLoading, error: geoError } = useGeolocation()

  const {
    data: hospitals = [],
    isLoading: hospitalsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['nearbyHospitals', latitude, longitude, radius],
    queryFn: () => fetchNearbyHospitals(latitude!, longitude!, radius),
    enabled: !!latitude && !!longitude,
  })

  useEffect(() => {
    if (!isLoggedIn) {
      setShowFavoritesOnly(false)
    }
  }, [isLoggedIn])

  const handleToggleFavorite = useCallback(
    async (hospitalId: number) => {
      try {
        await toggleFavorite(hospitalId)
      } catch (err) {
        alert(err instanceof Error ? err.message : '즐겨찾기 처리 중 오류가 발생했습니다.')
      }
    },
    [toggleFavorite]
  )

  const departments = useMemo(() => {
    const set = new Set<string>()
    hospitals.forEach((i) => {
      if (i.hospital.department?.trim()) set.add(i.hospital.department.trim())
    })
    return Array.from(set).sort()
  }, [hospitals])

  const filteredHospitals = useMemo(
    () => filterNearbyHospitals(hospitals, searchKeyword, departmentFilter),
    [hospitals, searchKeyword, departmentFilter]
  )

  const visibleHospitals = useMemo(
    () =>
      showFavoritesOnly
        ? filteredHospitals.filter((i) => favoriteIds.has(i.hospital.id))
        : filteredHospitals,
    [filteredHospitals, showFavoritesOnly, favoriteIds]
  )

  if (mapError) {
    const isProdHost =
      typeof window !== 'undefined' &&
      !/localhost|127\.0\.0\.1/i.test(window.location.hostname)
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-6">
        <div className="text-center max-w-md">
          <div className="text-red-500 font-medium">카카오 지도 로드 실패</div>
          <p className="mt-2 text-sm text-gray-600">{mapError}</p>
          <p className="mt-3 text-sm text-gray-500">
            {isProdHost ? (
              <>
                EC2에서 프론트 이미지를 빌드할 때{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">VITE_KAKAO_APP_KEY</code>가
                전달되어야 합니다. 저장소 루트 <code className="text-xs bg-gray-100 px-1 rounded">.env</code>
                에 해당 값을 넣거나 <code className="text-xs bg-gray-100 px-1 rounded">export</code> 한 뒤{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  docker compose ... build --no-cache frontend
                </code>
                를 다시 실행하세요. 카카오 디벨로퍼스 &gt; 내 애플리케이션 &gt; 플랫폼 &gt; Web 에{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">https://medicheck.life</code>
                (및 사용 중인 도메인)을 등록하세요.
              </>
            ) : (
              <>
                <code className="text-xs bg-gray-100 px-1 rounded">frontend/.env</code>에{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">VITE_KAKAO_APP_KEY</code>를 설정하고,
                카카오 디벨로퍼스 Web 플랫폼에{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">http://localhost:5173</code>을
                등록하세요.
              </>
            )}
          </p>
        </div>
      </div>
    )
  }

  if (geoError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] p-6">
        <div className="text-center max-w-md bg-amber-50 rounded-2xl p-8 border border-amber-100">
          <div className="text-amber-700 font-medium">위치 권한이 필요합니다</div>
          <p className="mt-2 text-sm text-amber-600">
            브라우저에서 위치 접근을 허용해 주세요.
          </p>
        </div>
      </div>
    )
  }

  if (!mapLoaded || geoLoading || (latitude === null && longitude === null)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">지도 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (latitude === null || longitude === null) {
    return null
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] min-h-0 bg-gray-50 safe-area-pb">
      {/* 모바일: 목록 열렸을 때 배경 딤드 (탭하면 닫기) */}
      {isListOpen && (
        <div
          className="fixed inset-0 top-14 z-20 bg-black/40 md:hidden"
          onClick={() => setIsListOpen(false)}
          aria-hidden
        />
      )}
      {/* 병원 목록 패널: 모바일에서 열면 화면 전체, 데스크톱은 좌측 패널 */}
      <aside
        className={`shrink-0 bg-white border-r border-gray-100 shadow-sm transition-all duration-300
          fixed inset-y-0 left-0 top-14 z-30 w-full max-w-[min(400px,92vw)] md:relative md:inset-auto md:top-auto md:z-auto md:w-0 md:max-w-none
          ${isListOpen ? 'translate-x-0 max-w-none md:max-w-[min(400px,92vw)] md:w-80' : '-translate-x-full md:translate-x-0 md:overflow-hidden'}`}
        inert={!isListOpen || undefined}
        aria-hidden={!isListOpen}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">근처 병원</h2>
              <button
                type="button"
                onClick={() => setIsListOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 -m-2 md:min-w-0 md:min-h-0 md:p-1.5"
                aria-label="목록 닫기"
              >
                ◀
              </button>
            </div>
            <button
              type="button"
              onClick={() => mapRef.current?.panTo(latitude, longitude)}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium shadow-sm"
              aria-label="내 위치로 이동"
            >
              <span aria-hidden>📍</span>
              내 위치로 이동
            </button>

            <div className="mt-3">
              <div
                className="flex flex-wrap gap-2 mb-2"
                role="group"
                aria-label="검색 반경 선택"
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRadius(opt.value)}
                    aria-pressed={radius === opt.value}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      radius === opt.value
                        ? 'bg-sky-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-sky-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="search"
                placeholder="병원명, 주소, 진료과 검색"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white"
              >
                <option value="">전체 진료과</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly(false)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                    !showFavoritesOnly
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => isLoggedIn && setShowFavoritesOnly(true)}
                  disabled={!isLoggedIn}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                    showFavoritesOnly
                      ? 'bg-sky-500 text-white border-sky-500'
                      : 'bg-white text-gray-600 border-gray-200'
                  } ${!isLoggedIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  즐겨찾기만 보기
                </button>
              </div>
            </div>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto">
            {hospitalsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
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
              <div className="text-center py-8 text-gray-400 text-sm">병원이 없습니다</div>
            ) : visibleHospitals.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {showFavoritesOnly ? '즐겨찾기한 병원이 없습니다' : '검색 결과가 없습니다'}
              </div>
            ) : (
              visibleHospitals.map((item) => (
                <HospitalListItem
                  key={item.hospital.id}
                  item={item}
                  onClick={() => mapRef.current?.showHospitalPopup(item)}
                  isFavorite={favoriteIds.has(item.hospital.id)}
                  onToggleFavorite={
                    isLoggedIn ? () => handleToggleFavorite(item.hospital.id) : undefined
                  }
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* 지도 영역 */}
      <div className="flex-1 relative min-w-0">
        {!isListOpen && (
          <button
            ref={openListButtonRef}
            type="button"
            onClick={() => setIsListOpen(true)}
            className="absolute top-1/2 left-0 -translate-y-1/2 translate-x-1/2 z-20 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-r-xl bg-white/95 border border-gray-200 shadow hover:bg-white"
            aria-label="근처 병원 목록 열기"
          >
            ▶
          </button>
        )}
        <HospitalMap
          ref={mapRef}
          centerLat={latitude}
          centerLng={longitude}
          hospitals={visibleHospitals}
          selectedHospital={selectedHospital}
          onSelectHospital={setSelectedHospital}
          onClosePopup={handleClosePopup}
        />
        {selectedHospital && (
          <HospitalBottomSheet
            item={selectedHospital}
            onClose={handleClosePopup}
            onOpenReviews={setReviewHospitalId}
            isFavorite={favoriteIds.has(selectedHospital.hospital.id)}
            onToggleFavorite={
              isLoggedIn ? () => handleToggleFavorite(selectedHospital.hospital.id) : undefined
            }
          />
        )}
        {reviewHospitalId != null && (
          <HospitalReviewModal
            hospitalId={reviewHospitalId}
            hospitalName={
              visibleHospitals.find((h) => h.hospital.id === reviewHospitalId)?.hospital.name ??
              '병원'
            }
            onClose={() => setReviewHospitalId(null)}
          />
        )}

        {/* 플로팅 컨트롤 - 병원 개수만 표시 */}
        <div className="absolute top-4 right-4 flex items-start gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="px-4 py-2 bg-white/95 rounded-xl shadow text-sm text-gray-600">
              <span className="font-semibold text-sky-600">{visibleHospitals.length}</span>
              {visibleHospitals.length !== filteredHospitals.length
                ? ` / ${filteredHospitals.length}`
                : ''}
              개 병원
            </div>
            {!isListOpen && (
              <button
                type="button"
                onClick={() => setIsListOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 bg-white/95 rounded-xl shadow hover:bg-white"
                aria-label="목록 열기"
              >
                ▶
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

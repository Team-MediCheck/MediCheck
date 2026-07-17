import { useCallback, useRef, useState, useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { HospitalMap, type HospitalMapHandle } from '../components/HospitalMap'
import { HospitalBottomSheet } from '../components/HospitalBottomSheet'
import { HospitalReviewModal } from '../components/HospitalReviewModal'
import { MapDistanceFilter } from '../components/MapDistanceFilter'
import { SidebarNav } from '../components/SidebarNav'
import { SearchPanel } from '../components/panels/SearchPanel'
import { SymptomPanel } from '../components/panels/SymptomPanel'
import { FavoritesPanel } from '../components/panels/FavoritesPanel'
import { useFavorites } from '../hooks/useFavorites'
import { useGeolocation } from '../hooks/useGeolocation'
import { useKakaoMapScript } from '../hooks/useKakaoMapScript'
import type { NearbyHospital } from '../types/hospital'

type MainTab = 'search' | 'symptom' | 'favorites'

function tabFromPath(pathname: string, mainTabParam?: string): MainTab {
  // Prefer the matched route param — source of truth after /:mainTab routing.
  if (mainTabParam === 'symptom' || mainTabParam === 'favorites' || mainTabParam === 'search') {
    return mainTabParam
  }
  if (pathname.startsWith('/symptom')) return 'symptom'
  if (pathname.startsWith('/favorites')) return 'favorites'
  return 'search'
}

export function MainPage() {
  const { pathname } = useLocation()
  const { mainTab: mainTabParam } = useParams()
  const activeTab = tabFromPath(pathname, mainTabParam)

  const [radius, setRadius] = useState(3000)
  const [isPanelOpen, setIsPanelOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  )
  const [mapHospitals, setMapHospitals] = useState<NearbyHospital[]>([])
  const mapRef = useRef<HospitalMapHandle>(null)
  const openPanelButtonRef = useRef<HTMLButtonElement>(null)
  const { favoriteIds, toggleFavorite, isLoggedIn } = useFavorites()
  const [reviewHospitalId, setReviewHospitalId] = useState<number | null>(null)
  const [selectedHospital, setSelectedHospital] = useState<NearbyHospital | null>(null)

  const handleClosePopup = useCallback(() => setSelectedHospital(null), [])
  const { loaded: mapLoaded, error: mapError } = useKakaoMapScript()
  const { latitude, longitude, loading: geoLoading, error: geoError } = useGeolocation()

  /** 증상별·즐겨찾기는 사이드바를 기본으로 연 상태 유지 */
  const isPanelOpenForTab = activeTab !== 'search' || isPanelOpen
  const mapReady =
    !geoError && !mapError && !geoLoading && latitude != null && longitude != null

  useEffect(() => {
    if (activeTab !== 'search') setIsPanelOpen(true)
  }, [activeTab])

  useEffect(() => {
    if (!isPanelOpenForTab) openPanelButtonRef.current?.focus({ preventScroll: true })
  }, [isPanelOpenForTab])

  useEffect(() => {
    setSelectedHospital(null)
    setReviewHospitalId(null)
  }, [activeTab])

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

  const handleVisibleHospitalsChange = useCallback((hospitals: NearbyHospital[]) => {
    setMapHospitals(hospitals)
  }, [])

  const handleHospitalClick = useCallback((item: NearbyHospital) => {
    mapRef.current?.showHospitalPopup(item)
  }, [])

  const renderPanelBody = () => {
    // 즐겨찾기/증상별은 위치 권한과 무관하게 패널을 보여 준다.
    if (activeTab === 'favorites') {
      return (
        <FavoritesPanel
          onHospitalsChange={handleVisibleHospitalsChange}
          onHospitalClick={handleHospitalClick}
        />
      )
    }
    if (activeTab === 'symptom') {
      return (
        <SymptomPanel
          onHospitalsChange={handleVisibleHospitalsChange}
          onHospitalClick={handleHospitalClick}
        />
      )
    }
    if (geoError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center max-w-md bg-amber-50 rounded-2xl p-8 border border-amber-100">
            <div className="text-amber-700 font-medium">위치 권한이 필요합니다</div>
            <p className="mt-2 text-sm text-amber-600">
              브라우저에서 위치 접근을 허용해 주세요.
            </p>
          </div>
        </div>
      )
    }
    if (mapError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="text-red-500 font-medium">카카오 지도 로드 실패</div>
            <p className="mt-2 text-sm text-gray-600">{mapError}</p>
          </div>
        </div>
      )
    }
    if (!mapReady) {
      return (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">
              {!mapLoaded ? '지도 불러오는 중...' : '위치 확인 중...'}
            </span>
          </div>
        </div>
      )
    }
    return (
      <SearchPanel
        latitude={latitude}
        longitude={longitude}
        radius={radius}
        onHospitalClick={handleHospitalClick}
        onPanToUser={() => mapRef.current?.panTo(latitude, longitude)}
        onVisibleHospitalsChange={handleVisibleHospitalsChange}
      />
    )
  }

  /*
    Map column is first in DOM (underlay). Aside is second so it paints above when
    absolutely positioned on mobile — Kakao tiles often spill left under the drawer.
    While the drawer is open on mobile, disable pointer events on the entire map
    column so spilled tiles/canvas cannot steal taps meant for SidebarNav / 로그인.
  */
  const mapPaneClassName = `flex-1 relative min-w-0 z-0 order-2 overflow-hidden ${
    isPanelOpenForTab ? 'max-md:pointer-events-none' : ''
  }`

  const asideClassName = `shrink-0 order-1 bg-white border-r border-gray-100 shadow-sm transition-all duration-300 pointer-events-auto
        absolute inset-y-0 left-0 z-50 w-full max-w-[min(400px,92vw)]
        md:relative md:inset-auto md:z-20 md:max-w-none
        ${isPanelOpenForTab ? 'translate-x-0 md:w-80' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden'}`

  return (
    <div
      className="relative flex h-full min-h-0 isolate bg-gray-50 safe-area-pb"
      data-active-tab={activeTab}
      data-pathname={pathname}
    >
      <div className={mapPaneClassName}>
        {/* Mobile dim: map column only; re-enable clicks to dismiss search panel */}
        {isPanelOpenForTab && (
          <div
            className="absolute inset-0 z-10 bg-black/40 md:hidden pointer-events-auto"
            onClick={() => {
              if (activeTab === 'search') setIsPanelOpen(false)
            }}
            aria-hidden
          />
        )}

        {!isPanelOpenForTab && (
          <button
            ref={openPanelButtonRef}
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="absolute top-1/2 left-0 -translate-y-1/2 translate-x-1/2 z-20 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-r-xl bg-white/95 border border-gray-200 shadow hover:bg-white pointer-events-auto"
            aria-label="패널 열기"
          >
            ▶
          </button>
        )}

        {mapReady && mapLoaded && (
          <>
            <HospitalMap
              ref={mapRef}
              centerLat={latitude}
              centerLng={longitude}
              hospitals={mapHospitals}
              selectedHospital={selectedHospital}
              onSelectHospital={setSelectedHospital}
              onClosePopup={handleClosePopup}
            />
            {activeTab === 'search' && (
              <div className={isPanelOpenForTab ? 'max-md:pointer-events-auto' : undefined}>
                <MapDistanceFilter radius={radius} onRadiusChange={setRadius} />
              </div>
            )}
          </>
        )}

        {!mapReady && !geoError && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-500 text-sm">
                {!mapLoaded ? '지도 불러오는 중...' : '위치 확인 중...'}
              </span>
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-20 flex items-start gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="px-4 py-2 bg-white/95 rounded-xl shadow text-sm text-gray-600">
              <span className="font-semibold text-sky-600">{mapHospitals.length}</span>개 병원
            </div>
            {!isPanelOpenForTab && (
              <button
                type="button"
                onClick={() => setIsPanelOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 bg-white/95 rounded-xl shadow hover:bg-white"
                aria-label="패널 열기"
              >
                ▶
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className={asideClassName} aria-hidden={!isPanelOpenForTab}>
        <div className="h-full flex flex-col relative z-10 pointer-events-auto bg-white">
          <div className="shrink-0 relative z-30 bg-white pointer-events-auto">
            <div className="flex items-center justify-between md:hidden px-3 pt-2">
              <span className="text-sm font-medium text-gray-700">메뉴</span>
              {activeTab === 'search' ? (
                <button
                  type="button"
                  onClick={() => setIsPanelOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500"
                  aria-label="패널 닫기"
                >
                  ✕
                </button>
              ) : (
                <span className="min-w-[44px] min-h-[44px]" aria-hidden />
              )}
            </div>
            <SidebarNav />
          </div>

          <div
            className="flex-1 min-h-0 flex flex-col overflow-hidden relative z-10 pointer-events-auto bg-white"
            {...(!isPanelOpenForTab ? { inert: true as const } : {})}
          >
            {renderPanelBody()}
          </div>
        </div>
      </aside>

      {/* Sheets live outside the map pane so mobile pointer-events-none cannot block them */}
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
            mapHospitals.find((h) => h.hospital.id === reviewHospitalId)?.hospital.name ??
            selectedHospital?.hospital.name ??
            '병원'
          }
          onClose={() => setReviewHospitalId(null)}
        />
      )}
    </div>
  )
}

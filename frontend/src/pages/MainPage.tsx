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

  /** 모든 탭에서 패널 열림/닫힘 동일 (지도 영역 탭으로 닫기 가능) */
  const isPanelOpenForTab = isPanelOpen
  const mapReady =
    !geoError && !mapError && !geoLoading && latitude != null && longitude != null

  useEffect(() => {
    // 증상별·즐겨찾기로 이동할 때는 패널을 다시 연다
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
    // 자식 패널은 useQuery 로딩 시 매 렌더 새 배열을 올려보낼 수 있다.
    // 내용이 같으면 setState 자체를 건너뛰어 "Maximum update depth exceeded"(React #185)를 막는다.
    setMapHospitals((prev) => {
      if (
        prev.length === hospitals.length &&
        prev.every((h, i) => h.hospital.id === hospitals[i]?.hospital.id)
      ) {
        return prev
      }
      return hospitals
    })
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
            onClick={() => setIsPanelOpen(false)}
            aria-hidden
          />
        )}

        {!isPanelOpenForTab && (
          <button
            ref={openPanelButtonRef}
            type="button"
            onClick={() => setIsPanelOpen(true)}
            className="absolute top-1/2 left-0 -translate-y-1/2 z-20 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-r-xl bg-white/95 border border-l-0 border-gray-200 shadow hover:bg-white pointer-events-auto"
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

        {mapReady && (
          <div
            className={`absolute top-4 right-4 z-20 pointer-events-none ${
              isPanelOpenForTab ? 'max-md:pointer-events-auto' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => mapRef.current?.panTo(latitude!, longitude!)}
              className="pointer-events-auto w-11 h-11 flex items-center justify-center bg-white/95 hover:bg-white text-sky-600 rounded-xl shadow border border-gray-100"
              aria-label="내 위치로 이동"
              title="내 위치로 이동"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
                aria-hidden
              >
                <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19a7 7 0 110-14 7 7 0 010 14z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <aside className={asideClassName} aria-hidden={!isPanelOpenForTab}>
        <div className="h-full flex flex-col relative z-10 pointer-events-auto bg-white">
          <div className="shrink-0 relative z-30 bg-white pointer-events-auto">
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

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import type { NearbyHospital } from '../types/hospital'

declare const kakao: {
  maps: {
    Map: new (container: HTMLElement, options: unknown) => {
      setCenter: (pos: unknown) => void
      getCenter: () => { getLat: () => number; getLng: () => number }
      setBounds: (bounds: unknown) => void
    }
    LatLng: new (lat: number, lng: number) => unknown
    LatLngBounds: new (sw: unknown, ne?: unknown) => {
      extend: (point: unknown) => void
    }
    Size: new (width: number, height: number) => unknown
    MarkerImage: new (url: string, size: unknown, option?: unknown) => unknown
    Marker: new (options: { position: unknown; image?: unknown; map?: unknown }) => unknown
    CustomOverlay: new (options: {
      content: string | HTMLElement
      position: unknown
      xAnchor?: number
      yAnchor?: number
      zIndex?: number
    }) => { setMap: (map: unknown) => void }
    MarkerClusterer: new (options: {
      map: unknown
      averageCenter?: boolean
      minLevel?: number
      disableClickZoom?: boolean
    }) => {
      addMarkers: (markers: unknown[]) => void
      clear: () => void
    }
    event: {
      addListener: (target: unknown, type: string, handler: () => void) => void
      removeListener?: (target: unknown, type: string, handler: () => void) => void
    }
  }
}

export interface HospitalMapHandle {
  panTo: (lat: number, lng: number) => void
  showHospitalPopup: (item: NearbyHospital) => void
}

interface HospitalMapProps {
  centerLat: number
  centerLng: number
  hospitals: NearbyHospital[]
  selectedHospital?: NearbyHospital | null
  onSelectHospital?: (item: NearbyHospital) => void
  onClosePopup?: () => void
}

export const HospitalMap = forwardRef<HospitalMapHandle, HospitalMapProps>(
  function HospitalMap({ centerLat, centerLng, hospitals, selectedHospital, onSelectHospital, onClosePopup }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<{
      setCenter: (pos: unknown) => void
      getCenter: () => { getLat: () => number; getLng: () => number }
      setBounds: (bounds: unknown) => void
    } | null>(null)
    const markersRef = useRef<Array<{ setMap: (m: unknown) => void }>>([])
    const selectedLabelOverlayRef = useRef<{ setMap: (m: unknown) => void } | null>(null)
    const clustererRef = useRef<{ addMarkers: (ms: unknown[]) => void; clear: () => void } | null>(
      null
    )
    const ignoreMapClickRef = useRef(false)

    const panToWithAnimation = (targetLat: number, targetLng: number) => {
      const map = mapRef.current
      if (!map || !window.kakao?.maps) return

      const center = map.getCenter()
      const startLat = center.getLat()
      const startLng = center.getLng()

      const duration = 450
      const startTime = performance.now()

      const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

      const animate = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = easeOutCubic(progress)

        const lat = startLat + (targetLat - startLat) * eased
        const lng = startLng + (targetLng - startLng) * eased
        map.setCenter(new kakao.maps.LatLng(lat, lng))

        if (progress < 1) requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }

    const clearSelectedLabel = () => {
      if (selectedLabelOverlayRef.current) {
        selectedLabelOverlayRef.current.setMap(null)
        selectedLabelOverlayRef.current = null
      }
    }

    const showSelectedLabel = (item: NearbyHospital) => {
      const map = mapRef.current
      if (!map || !window.kakao?.maps) return
      clearSelectedLabel()
      const h = item.hospital
      const lat = h.latitude ?? 0
      const lng = h.longitude ?? 0
      if (lat === 0 && lng === 0) return
      const labelEl = document.createElement('div')
      labelEl.className = 'hospital-marker-label'
      labelEl.textContent = h.name
      labelEl.style.cssText = `
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 600;
        color: #0c4a6e;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        white-space: nowrap;
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        border: 1px solid #e2e8f0;
        pointer-events: none;
      `
      const overlay = new kakao.maps.CustomOverlay({
        content: labelEl,
        position: new kakao.maps.LatLng(lat, lng),
        xAnchor: 0.5,
        yAnchor: 1,
        zIndex: 4,
      })
      overlay.setMap(map)
      selectedLabelOverlayRef.current = overlay as { setMap: (m: unknown) => void }
    }

    useImperativeHandle(ref, () => ({
      panTo(lat: number, lng: number) {
        panToWithAnimation(lat, lng)
      },
      showHospitalPopup(item: NearbyHospital) {
        const h = item.hospital
        const lat = h.latitude ?? 0
        const lng = h.longitude ?? 0
        if (lat === 0 && lng === 0) return
        if (!mapRef.current || !window.kakao?.maps) return
        showSelectedLabel(item)
        onSelectHospital?.(item)
        panToWithAnimation(lat, lng)
      },
    }), [onSelectHospital])

    useEffect(() => {
      if (!containerRef.current || !window.kakao?.maps) return

      const map = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(centerLat, centerLng),
        level: 5,
      })
      mapRef.current = map

      // 마커 클러스터러 생성 (많은 병원 마커를 효율적으로 표시)
      const clusterer = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 7,
        disableClickZoom: false,
      })
      clustererRef.current = clusterer

      // 내 위치 마커 (파란 동그라미)
      const myLocationEl = document.createElement('div')
      myLocationEl.innerHTML = `
        <div style="
          width: 20px; height: 20px;
          border-radius: 50%;
          background: #4285f4;
          border: 3px solid white;
          box-shadow: 0 1px 6px rgba(0,0,0,0.35);
        " title="내 위치"></div>
      `
      const myLocationOverlay = new kakao.maps.CustomOverlay({
        content: myLocationEl.firstElementChild as HTMLElement,
        position: new kakao.maps.LatLng(centerLat, centerLng),
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5,
      })
      myLocationOverlay.setMap(map)

      // 빈 지도 클릭 시 이름 라벨 제거, 하단 시트 닫기
      const onMapClick = () => {
        if (ignoreMapClickRef.current) {
          ignoreMapClickRef.current = false
          return
        }
        clearSelectedLabel()
        onClosePopup?.()
      }
      kakao.maps.event.addListener(map, 'click', onMapClick)

      return () => {
        myLocationOverlay.setMap(null)
        if (kakao.maps.event.removeListener) {
          kakao.maps.event.removeListener(map, 'click', onMapClick)
        }
         if (clustererRef.current) {
          clustererRef.current.clear()
          clustererRef.current = null
        }
        mapRef.current = null
      }
    }, [centerLat, centerLng, onClosePopup])

    useEffect(() => {
      const map = mapRef.current
      const clusterer = clustererRef.current
      if (!map || !window.kakao?.maps || !clusterer) return

      // 기존 마커 및 클러스터 제거 (선택된 병원 이름 라벨은 selectedLabelOverlayRef로 따로 관리)
      markersRef.current.forEach((m) => m.setMap(null))
      markersRef.current = []
      clusterer.clear()

      const newMarkers: Array<{ setMap: (m: unknown) => void }> = []

      const openSheet = (item: NearbyHospital, itemLat: number, itemLng: number) => {
        ignoreMapClickRef.current = true
        showSelectedLabel(item)
        onSelectHospital?.(item)
        panToWithAnimation(itemLat, itemLng)
      }

      // 작은 병원 마커 이미지 (기본 마커보다 축소)
      const markerSize = new kakao.maps.Size(20, 26)
      const markerImageUrl =
        'data:image/svg+xml,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30"><path fill="%23e53935" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18C24 5.4 18.6 0 12 0z"/><circle fill="white" cx="12" cy="12" r="5"/></svg>'
        )
      const markerImage = new kakao.maps.MarkerImage(markerImageUrl, markerSize)

      hospitals.forEach((item) => {
        const h = item.hospital
        const lat = h.latitude ?? 0
        const lng = h.longitude ?? 0
        if (lat === 0 && lng === 0) return

        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(lat, lng),
          image: markerImage,
        }) as { setMap: (m: unknown) => void }
        newMarkers.push(marker)

        kakao.maps.event.addListener(marker, 'click', () => {
          openSheet(item, lat, lng)
        })
      })

      if (newMarkers.length > 0) {
        clusterer.addMarkers(newMarkers as unknown[])
      }
      markersRef.current = newMarkers

      return () => {
        markersRef.current.forEach((m) => m.setMap(null))
        markersRef.current = []
      }
    }, [hospitals, onSelectHospital])

    // 시트가 닫히면(selectedHospital이 null) 선택된 병원 이름 라벨도 제거
    useEffect(() => {
      if (!selectedHospital) clearSelectedLabel()
    }, [selectedHospital])

    // Absolute fill + overflow clip: Kakao tiles often paint with negative offsets
    // and must never spill hit-targets into the sidebar region.
    return (
      <div className="absolute inset-0 overflow-hidden isolate contain-strict">
        <div ref={containerRef} className="h-full w-full overflow-hidden" />
      </div>
    )
  }
)

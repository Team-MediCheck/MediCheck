import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNearbyHospitals } from '../../api/hospitals'
import { HospitalListItem } from '../HospitalListItem'
import { useFavorites } from '../../hooks/useFavorites'
import { DEPARTMENTS, filterNearbyHospitals } from '../../lib/hospitalFilters'
import type { NearbyHospital } from '../../types/hospital'

/** useQuery 로딩 중 `data ?? []` 가 매 렌더 새 참조가 되지 않도록 */
const EMPTY_HOSPITALS: NearbyHospital[] = []

type SearchPanelProps = {
  latitude: number
  longitude: number
  radius: number
  onHospitalClick?: (item: NearbyHospital) => void
  onVisibleHospitalsChange?: (hospitals: NearbyHospital[]) => void
}

export function SearchPanel({
  latitude,
  longitude,
  radius,
  onHospitalClick,
  onVisibleHospitalsChange,
}: SearchPanelProps) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [department, setDepartment] = useState('전체')
  const { favoriteIds, toggleFavorite, isLoggedIn } = useFavorites()
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const favoritesFilterActive = isLoggedIn && showFavoritesOnly

  const {
    data,
    isLoading: hospitalsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['nearbyHospitals', latitude, longitude, radius],
    queryFn: () => fetchNearbyHospitals(latitude, longitude, radius),
    enabled: !!latitude && !!longitude,
  })
  const hospitals = data ?? EMPTY_HOSPITALS

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

  const filteredHospitals = useMemo(
    () => filterNearbyHospitals(hospitals, searchKeyword, department),
    [hospitals, searchKeyword, department]
  )

  const visibleHospitals = useMemo(
    () =>
      favoritesFilterActive
        ? filteredHospitals.filter((i) => favoriteIds.has(i.hospital.id))
        : filteredHospitals,
    [filteredHospitals, favoritesFilterActive, favoriteIds]
  )

  useEffect(() => {
    onVisibleHospitalsChange?.(visibleHospitals)
  }, [visibleHospitals, onVisibleHospitalsChange])

  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">근처 병원</h2>
          <span className="text-xs text-gray-500">
            <span className="font-semibold text-sky-600">{visibleHospitals.length}</span>곳
          </span>
        </div>

        <div className="space-y-2">
          <input
            type="search"
            placeholder="병원명, 주소, 진료과 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="진료과 선택">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartment(dept)}
                aria-pressed={department === dept}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  department === dept
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(false)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                !favoritesFilterActive
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
                favoritesFilterActive
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
            {favoritesFilterActive ? '즐겨찾기한 병원이 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          visibleHospitals.map((item) => (
            <HospitalListItem
              key={item.hospital.id}
              item={item}
              onClick={onHospitalClick ? () => onHospitalClick(item) : undefined}
              isFavorite={favoriteIds.has(item.hospital.id)}
              onToggleFavorite={
                isLoggedIn ? () => handleToggleFavorite(item.hospital.id) : undefined
              }
            />
          ))
        )}
      </div>
    </>
  )
}

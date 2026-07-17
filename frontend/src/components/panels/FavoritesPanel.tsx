import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchFavoriteHospitals } from '../../api/hospitals'
import { HospitalListItem } from '../HospitalListItem'
import { useAuth } from '../../contexts/AuthContext'
import type { Hospital, NearbyHospital } from '../../types/hospital'

function toNearbyItem(h: Hospital): NearbyHospital {
  return { hospital: h, distanceMeters: 0 }
}

type FavoritesPanelProps = {
  onHospitalsChange?: (hospitals: NearbyHospital[]) => void
  onHospitalClick?: (item: NearbyHospital) => void
}

export function FavoritesPanel({ onHospitalsChange, onHospitalClick }: FavoritesPanelProps) {
  const { token, user, isLoading: authLoading } = useAuth()

  const {
    data: hospitals = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => fetchFavoriteHospitals(token!),
    enabled: !!token && !!user,
  })

  useEffect(() => {
    if (!token || !user) {
      onHospitalsChange?.([])
      return
    }
    onHospitalsChange?.(hospitals.map(toNearbyItem))
  }, [hospitals, onHospitalsChange, token, user])

  if (authLoading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!token || !user) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 bg-white">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4" aria-hidden>
            ♡
          </div>
          <div className="text-base font-semibold text-gray-800 mb-2">로그인이 필요합니다</div>
          <p className="text-sm text-gray-600 mb-6">즐겨찾기 기능을 사용하려면 로그인해 주세요</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center min-h-[44px] px-8 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"
          >
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">즐겨찾기</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {user.name || user.loginId}님이 저장한 병원
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-sky-600">{hospitals.length}</span>곳
          </div>
        </div>
      </div>

      <div className="p-2 space-y-1 flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-6 text-center mx-2 mt-4">
            <div className="text-amber-700 font-medium mb-2">즐겨찾기 목록을 불러오지 못했습니다</div>
            <p className="text-sm text-amber-700 mb-4">
              {error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"
            >
              다시 시도
            </button>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-5xl mb-4 text-gray-300" aria-hidden>
              ♡
            </div>
            <div className="text-gray-700 font-medium mb-2">즐겨찾기가 없습니다</div>
            <p className="text-sm text-gray-500 mb-6">자주 가는 병원을 즐겨찾기에 추가해 보세요</p>
            <Link
              to="/search"
              className="inline-block px-8 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium"
            >
              병원 찾기
            </Link>
          </div>
        ) : (
          hospitals.map((h) => {
            const item = toNearbyItem(h)
            return (
              <HospitalListItem
                key={h.id}
                item={item}
                showDistance={false}
                isFavorite
                onClick={onHospitalClick ? () => onHospitalClick(item) : undefined}
              />
            )
          })
        )}
      </div>
    </>
  )
}

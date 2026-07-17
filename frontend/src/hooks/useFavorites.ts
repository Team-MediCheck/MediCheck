import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import {
  addFavoriteHospital,
  fetchFavoriteHospitals,
  removeFavoriteHospital,
} from '../api/hospitals'
import { useAuth } from '../contexts/AuthContext'

export function useFavorites() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => fetchFavoriteHospitals(token!),
    enabled: !!token,
  })

  const favoriteIds = useMemo(() => new Set(favorites.map((h) => h.id)), [favorites])

  const mutation = useMutation({
    mutationFn: async ({ hospitalId, isFavorite }: { hospitalId: number; isFavorite: boolean }) => {
      if (!token) throw new Error('로그인이 필요합니다.')
      if (isFavorite) {
        await removeFavoriteHospital(token, hospitalId)
      } else {
        await addFavoriteHospital(token, hospitalId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const toggleFavorite = useCallback(
    async (hospitalId: number) => {
      if (!token) throw new Error('로그인이 필요합니다.')
      const isFavorite = favoriteIds.has(hospitalId)
      await mutation.mutateAsync({ hospitalId, isFavorite })
    },
    [token, favoriteIds, mutation]
  )

  return {
    favorites,
    favoriteIds,
    toggleFavorite,
    isLoggedIn: !!token,
  }
}

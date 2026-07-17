import type { Hospital, NearbyHospital, Page } from '../types/hospital'

const API_BASE = '/api'

export async function fetchNearbyHospitals(
  lat: number,
  lng: number,
  radiusMeters = 3000
): Promise<NearbyHospital[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusMeters: String(radiusMeters),
  })
  const res = await fetch(`${API_BASE}/hospitals/nearby?${params}`)
  if (!res.ok) throw new Error('근처 병원 조회 실패')
  return res.json()
}

export async function fetchHospitalsBySymptom(params: {
  symptom: string
  lat?: number
  lng?: number
  page?: number
  size?: number
}): Promise<Page<Hospital>> {
  const search = new URLSearchParams({ symptom: params.symptom })
  if (params.lat != null) search.set('lat', String(params.lat))
  if (params.lng != null) search.set('lng', String(params.lng))
  if (params.page != null) search.set('page', String(params.page))
  if (params.size != null) search.set('size', String(params.size))
  const res = await fetch(`${API_BASE}/hospitals/search/symptom?${search}`)
  if (!res.ok) throw new Error('증상별 병원 검색 실패')
  return res.json()
}

export async function fetchSymptomPickerKeywords(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/hospitals/search/symptom-keywords`)
  if (!res.ok) throw new Error('증상 키워드 조회 실패')
  return res.json()
}

export async function fetchHospitalById(id: number): Promise<Hospital | null> {
  const res = await fetch(`${API_BASE}/hospitals/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('병원 상세 조회 실패')
  return res.json()
}

export async function fetchFavoriteHospitals(token: string): Promise<Hospital[]> {
  const res = await fetch(`${API_BASE}/users/me/favorites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (!res.ok) throw new Error('즐겨찾기 병원 조회 실패')
  return res.json()
}

export async function addFavoriteHospital(token: string, hospitalId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/users/me/favorites/${hospitalId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (!res.ok) throw new Error('즐겨찾기 추가 실패')
}

export async function removeFavoriteHospital(token: string, hospitalId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/users/me/favorites/${hospitalId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (!res.ok) throw new Error('즐겨찾기 해제 실패')
}

// --- 병원 리뷰 API ---

export interface HospitalReview {
  id: number
  userId: number
  userDisplayName: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewPage {
  content: HospitalReview[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export async function fetchHospitalReviews(
  hospitalId: number,
  page = 0,
  size = 20
): Promise<ReviewPage> {
  const res = await fetch(
    `${API_BASE}/hospitals/${hospitalId}/reviews?page=${page}&size=${size}`
  )
  if (!res.ok) throw new Error('리뷰 목록 조회 실패')
  return res.json()
}

export async function fetchMyReview(
  token: string,
  hospitalId: number
): Promise<HospitalReview | null> {
  const res = await fetch(
    `${API_BASE}/hospitals/${hospitalId}/reviews/me`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (res.status === 204) return null
  if (!res.ok) throw new Error('내 리뷰 조회 실패')
  return res.json()
}

export async function submitHospitalReview(
  token: string,
  hospitalId: number,
  rating: number,
  comment: string
): Promise<HospitalReview> {
  const res = await fetch(`${API_BASE}/hospitals/${hospitalId}/reviews`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rating, comment: comment || null }),
  })
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (!res.ok) throw new Error('리뷰 저장 실패')
  return res.json()
}

export async function deleteMyReview(
  token: string,
  hospitalId: number
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/hospitals/${hospitalId}/reviews/me`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (res.status === 401) throw new Error('로그인이 필요합니다.')
  if (!res.ok) throw new Error('리뷰 삭제 실패')
}

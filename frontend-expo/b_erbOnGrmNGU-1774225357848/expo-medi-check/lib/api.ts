import Constants from 'expo-constants'
import { useAuthStore } from '@/store/authStore'
import {
  Hospital,
  NearbyHospital,
  HospitalReview,
  Page,
  AuthResponse,
  AuthUser,
  LoginRequest,
  SignupRequest,
  HospitalReviewRequest,
  DirectionsResponse,
  MyHospitalReviewItem,
} from '@/types'

/**
 * 백엔드는 `/api` 프리픽스로 컨트롤러를 노출합니다.
 * EXPO_PUBLIC_API_URL에 호스트만 적은 경우(예: http://192.168.0.5:8080) `/api`가 빠져 404가 나므로 보정합니다.
 */
function resolveApiBaseUrl(raw: string | undefined): string {
  const fallbackHost = 'http://localhost:8080'
  const trimmed = (raw ?? '').trim() || fallbackHost
  const noTrailingSlash = trimmed.replace(/\/+$/, '')
  if (noTrailingSlash.endsWith('/api')) return noTrailingSlash
  return `${noTrailingSlash}/api`
}

const BASE_URL = resolveApiBaseUrl(
  Constants.expoConfig?.extra?.apiUrl as string | undefined
)

/** RN에서 서버가 꺼져 있거나 주소가 틀리면 fetch가 끝나지 않는 경우가 있어 상한을 둡니다. */
const FETCH_TIMEOUT_MS = 25_000

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, FETCH_TIMEOUT_MS)

  const parentSignal = options.signal
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else
      parentSignal.addEventListener('abort', () => controller.abort(), {
        once: true,
      })
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        timedOut
          ? '서버 응답이 없습니다. 백엔드 실행 여부와 EXPO_PUBLIC_API_URL(실기기는 PC IP)을 확인해 주세요.'
          : '요청이 취소되었습니다.'
      )
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    let message = `API Error: ${response.status}`
    try {
      const parsed = JSON.parse(errBody)
      if (parsed?.message) message = parsed.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  if (response.status === 204) return null as T
  return response.json()
}

// ─── 병원 API ────────────────────────────────────────────────────

export async function getHospitals(params?: {
  keyword?: string
  department?: string
  page?: number
  size?: number
}): Promise<Page<Hospital>> {
  const searchParams = new URLSearchParams()
  if (params?.keyword) searchParams.set('keyword', params.keyword)
  if (params?.department) searchParams.set('department', params.department)
  if (params?.page !== undefined) searchParams.set('page', String(params.page))
  if (params?.size) searchParams.set('size', String(params.size))

  return fetchApi(`/hospitals?${searchParams}`)
}

/** HIRA Top5(진료량 상위 5개 질병명)와 부분 일치하는 병원만 페이지 조회. 서버는 1~5위 슬롯 순·같은 슬롯은 거리순 정렬 */
export async function getHospitalsBySymptom(params: {
  symptom: string
  lat?: number
  lng?: number
  page?: number
  size?: number
}): Promise<Page<Hospital>> {
  const searchParams = new URLSearchParams()
  searchParams.set('symptom', params.symptom)
  if (params.lat != null) searchParams.set('lat', String(params.lat))
  if (params.lng != null) searchParams.set('lng', String(params.lng))
  if (params.page !== undefined) searchParams.set('page', String(params.page))
  if (params.size !== undefined) searchParams.set('size', String(params.size))
  return fetchApi(`/hospitals/search/symptom?${searchParams}`)
}

/** DB에 동기화된 Top5 질병명만 모은 목록(증상 피커용) */
export async function getSymptomPickerKeywords(): Promise<string[]> {
  return fetchApi<string[]>('/hospitals/search/symptom-keywords')
}

export async function getHospital(id: number): Promise<Hospital> {
  return fetchApi(`/hospitals/${id}`)
}

export async function getNearbyHospitals(
  lat: number,
  lng: number,
  radiusMeters = 3000
): Promise<NearbyHospital[]> {
  return fetchApi(
    `/hospitals/nearby?lat=${lat}&lng=${lng}&radiusMeters=${radiusMeters}`
  )
}

// ─── 리뷰 API ────────────────────────────────────────────────────

export async function getHospitalReviews(
  hospitalId: number,
  page = 0,
  size = 10
): Promise<Page<HospitalReview>> {
  return fetchApi(
    `/hospitals/${hospitalId}/reviews?page=${page}&size=${size}`
  )
}

export async function getMyReview(
  hospitalId: number
): Promise<HospitalReview | null> {
  try {
    const token = useAuthStore.getState().token
    if (!token) return null
    const res = await fetch(`${BASE_URL}/hospitals/${hospitalId}/reviews/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 204) return null
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function createOrUpdateReview(
  hospitalId: number,
  data: HospitalReviewRequest
): Promise<HospitalReview> {
  return fetchApi(`/hospitals/${hospitalId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteMyReview(hospitalId: number): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/hospitals/${hospitalId}/reviews/me`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().token}`,
      },
    }
  )
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
}

// ─── 즐겨찾기 API ────────────────────────────────────────────────────

export async function getFavorites(): Promise<Hospital[]> {
  return fetchApi('/users/me/favorites')
}

export async function getMyReviews(
  page = 0,
  size = 20
): Promise<Page<MyHospitalReviewItem>> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('size', String(size))
  return fetchApi(`/users/me/reviews?${params}`)
}

export async function addFavorite(hospitalId: number): Promise<void> {
  await fetchApi(`/users/me/favorites/${hospitalId}`, {
    method: 'POST',
  })
}

export async function removeFavorite(hospitalId: number): Promise<void> {
  await fetchApi(`/users/me/favorites/${hospitalId}`, {
    method: 'DELETE',
  })
}

// ─── 인증 API ────────────────────────────────────────────────────

/** 백엔드 응답: { token: string } 또는 { token: string, message: string } */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function loginWithKakao(
  code: string,
  redirectUri: string
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login/kakao', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri }),
  })
}

export async function loginWithKakaoNativeAccessToken(
  accessToken: string
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>('/auth/login/kakao/native', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  })
}

/** 로그인 후 사용자 정보 조회. Bearer 토큰 필요 */
export async function getMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 || !res.ok) return null
    const data = await res.json()
    if (data?.error) return null
    return {
      userId: data.userId,
      loginId: data.loginId,
      name: data.name ?? '',
    }
  } catch {
    return null
  }
}

// ─── 길찾기 API ────────────────────────────────────────────────────

export async function getDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DirectionsResponse> {
  return fetchApi(
    `/directions?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
  )
}

const API_BASE = '/api'

export interface AuthUser {
  loginId: string
  name: string
  userId: number
}

export async function login(loginId: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message ?? '로그인에 실패했습니다.')
  return data as { token: string }
}

export async function signup(loginId: string, password: string, name: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId, password, name }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message ?? '회원가입에 실패했습니다.')
  return data as { token: string }
}

export async function loginWithKakao(code: string, redirectUri: string): Promise<{ token: string }> {
  const res = await fetch(`${API_BASE}/auth/login/kakao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message ?? '카카오 로그인에 실패했습니다.')
  return data as { token: string }
}

export async function fetchMe(token: string): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) return null
  const data = await res.json().catch(() => null)
  if (!data || data.error) return null
  return data as AuthUser
}

/** 회원 탈퇴. 계정·즐겨찾기·리뷰 삭제. */
export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204 || res.ok) return
  const data = await res.json().catch(() => ({}))
  throw new Error((data as { message?: string }).message ?? '계정 삭제에 실패했습니다.')
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchMe, type AuthUser } from '../api/auth'

const TOKEN_KEY = 'medicheck_token'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string) => void
  logout: () => void
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    // 즐겨찾기 캐시 등 사용자별 데이터 초기화
    queryClient.removeQueries({ queryKey: ['favorites'] })
  }, [queryClient])

  const login = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
  }, [])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }
     setIsLoading(true)
    let cancelled = false
    fetchMe(token).then((u) => {
      if (!cancelled) {
        setUser(u)
        if (!u) logout()
        setIsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        logout()
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [token, logout])

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout, setUser }),
    [user, token, isLoading, login, logout]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

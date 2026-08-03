import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { login } from '../api/auth'
import { getKakaoOAuthRedirectUri } from '../lib/kakaoOAuthRedirect'

export function LoginPage() {
  const navigate = useNavigate()
  const { login: setAuth } = useAuth()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleKakaoLogin = () => {
    const redirectUri = getKakaoOAuthRedirectUri()
    const params = new URLSearchParams({ redirectUri })
    // REST API 키(client_id)는 백엔드에서 주입해 인가 URL로 리다이렉트한다.
    window.location.href = `/api/auth/kakao/authorize?${params.toString()}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { token } = await login(loginId, password)
      setAuth(token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-6">로그인</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="loginId" className="block text-sm font-medium text-gray-700 mb-1">
              아이디
            </label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-medium disabled:opacity-50"
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full py-2.5 rounded-lg bg-yellow-300 hover:bg-yellow-400 text-gray-900 font-medium border border-yellow-300"
          >
            카카오로 로그인
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="text-sky-600 font-medium hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { token } = await login(loginId, password)
      setAuth(token)
      navigate('/search', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKakaoLogin = () => {
    setError('')
    const redirectUri = encodeURIComponent(getKakaoOAuthRedirectUri())
    window.location.href = `/api/auth/kakao/authorize?redirectUri=${redirectUri}`
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-6">로그인</h2>

        <button
          type="button"
          onClick={handleKakaoLogin}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#FEE500] hover:bg-[#F5DC00] text-[#191919] font-medium leading-none shadow-sm overflow-visible"
        >
          <span className="inline-flex shrink-0 w-5 h-5 items-center justify-center overflow-visible leading-none">
            <svg
              className="block w-5 h-5 overflow-visible"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                fill="#191919"
                d="M12 4C7.037 4 3 6.91 3 10.5c0 2.27 1.486 4.26 3.72 5.41-.146.53-.9 3.28-.93 3.5 0 0-.036.34.19.47.09.05.2.03.2.03.29-.04 3.37-2.22 3.9-2.59.48.06.98.1 1.52.1 4.963 0 9-2.91 9-6.5S16.963 4 12 4z"
              />
            </svg>
          </span>
          <span className="leading-none pt-px">카카오로 로그인</span>
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          <span>또는</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
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

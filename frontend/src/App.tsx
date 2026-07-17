import { Link, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AppLayout } from './components/AppLayout'
import { MainPage } from './pages/MainPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { KakaoCallbackPage } from './pages/KakaoCallbackPage'

const MAIN_TABS = new Set(['search', 'symptom', 'favorites'])

/**
 * Single matched route for /search|/symptom|/favorites.
 * Nested pathless layout + null Outlet was updating the browser URL without
 * reliably re-rendering tab UI (stuck favorites login while href=/symptom).
 */
function MainTabPage() {
  const { mainTab } = useParams()
  if (!mainTab || !MAIN_TABS.has(mainTab)) {
    return <Navigate to="/search" replace />
  }
  return <MainPage />
}

function Header() {
  const { user, logout, isLoading } = useAuth()
  return (
    <header className="shrink-0 h-14 min-h-[44px] z-40 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 shadow-sm safe-area-pt">
      <Link to="/search" className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-labelledby="app-logo-title">
            <title id="app-logo-title">MediCheck 로고</title>
            <path d="M11 4v16h2V4h-2zm-7 7h16v2H4v-2z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">MediCheck</h1>
          <span className="hidden sm:inline text-xs text-gray-500">내 주변 안심 병원 찾기</span>
        </div>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        {isLoading ? (
          <span className="text-sm text-gray-400">...</span>
        ) : user ? (
          <>
            <span className="text-sm text-gray-600 truncate min-w-0 max-w-[120px] sm:max-w-none" title={user.name || user.loginId}>
              {user.name || user.loginId}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 shrink-0 whitespace-nowrap"
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-sky-600">
              로그인
            </Link>
            <span className="text-gray-300">|</span>
            <Link to="/signup" className="text-sm font-medium text-sky-600 hover:underline">
              회원가입
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}

function AppContent() {
  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-gray-50">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto">
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/:mainTab" element={<MainTabPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/oauth/kakao/callback" element={<KakaoCallbackPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App

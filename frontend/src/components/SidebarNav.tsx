import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/search', label: '검색' },
  { to: '/symptom', label: '증상별' },
  { to: '/favorites', label: '즐겨찾기' },
] as const

export function SidebarNav() {
  return (
    <nav
      className="relative z-30 flex gap-2 p-3 border-b border-gray-100 bg-white shrink-0 pointer-events-auto"
      role="tablist"
      aria-label="주요 메뉴"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          role="tab"
          className={({ isActive }) =>
            `relative z-30 flex-1 min-h-[44px] flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors pointer-events-auto ${
              isActive
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-sky-50'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

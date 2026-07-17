import { RADIUS_OPTIONS } from '../lib/hospitalFilters'

interface MapDistanceFilterProps {
  radius: number
  onRadiusChange: (radius: number) => void
}

export function MapDistanceFilter({ radius, onRadiusChange }: MapDistanceFilterProps) {
  return (
    <div
      className="absolute bottom-4 right-4 z-20 pointer-events-none safe-area-pb"
      role="group"
      aria-label="검색 반경"
    >
      <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5 max-w-[min(100vw-2rem,28rem)] px-3 py-2 bg-white/95 backdrop-blur rounded-full shadow-lg border border-gray-100">
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onRadiusChange(opt.value)}
            aria-pressed={radius === opt.value}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              radius === opt.value
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-gray-50 text-gray-600 hover:bg-sky-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

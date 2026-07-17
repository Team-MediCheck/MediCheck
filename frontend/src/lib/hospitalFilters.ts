import type { Hospital, NearbyHospital } from '../types/hospital'

export const DEPARTMENTS = [
  '전체',
  '내과',
  '외과',
  '소아과',
  '정형외과',
  '피부과',
  '이비인후과',
  '안과',
  '치과',
  '산부인과',
  '비뇨기과',
  '신경과',
  '정신건강의학과',
] as const

export const RADIUS_OPTIONS = [
  { value: 1000, label: '1km' },
  { value: 3000, label: '3km' },
  { value: 5000, label: '5km' },
  { value: 10000, label: '10km' },
  // 서비스 최대 반경(50km) — 사실상 구미 전역
  { value: 50000, label: '거리 제한 없음' },
] as const

function normalizeSearchInput(s: string): string {
  return s
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
}

function nearbyDepartmentChipMatches(hospital: Hospital, needleRaw: string): boolean {
  const needle = needleRaw.trim().toLowerCase()
  if (!needle) return true

  const name = (hospital.name ?? '').trim().toLowerCase()
  const dept = (hospital.department ?? '').trim().toLowerCase()

  if (!name.includes(needle) && !dept.includes(needle)) {
    return false
  }

  if (needle === '외과') {
    if (
      name.includes('정형외과') ||
      dept.includes('정형외과') ||
      name.includes('성형외과') ||
      dept.includes('성형외과') ||
      name.includes('신경외과') ||
      dept.includes('신경외과') ||
      name.includes('흉부외과') ||
      dept.includes('흉부외과')
    ) {
      return false
    }
  }

  return true
}

export function filterNearbyHospitals(
  items: NearbyHospital[],
  keyword: string,
  department: string
): NearbyHospital[] {
  let list = items
  const kw = normalizeSearchInput(keyword)
  if (kw) {
    list = list.filter(({ hospital }) => {
      const name = (hospital.name ?? '').toLowerCase()
      const addr = (hospital.address ?? '').toLowerCase()
      const dept = (hospital.department ?? '').toLowerCase()
      return name.includes(kw) || addr.includes(kw) || dept.includes(kw)
    })
  }
  const deptTrim = department.trim()
  if (deptTrim !== '' && deptTrim !== '전체') {
    list = list.filter(({ hospital }) => nearbyDepartmentChipMatches(hospital, deptTrim))
  }
  return list
}

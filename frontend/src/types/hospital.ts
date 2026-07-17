export interface HospitalEvaluationSummary {
  ykiho: string | null
  yadmNm: string | null
  clCd: string | null
  clCdNm: string | null
  addr: string | null
  asmGrd01: string | null
  asmGrd03: string | null
  asmGrd04: string | null
  asmGrd05: string | null
  asmGrd06: string | null
  asmGrd07: string | null
  asmGrd08: string | null
  asmGrd09: string | null
  asmGrd10: string | null
  asmGrd12: string | null
  asmGrd13: string | null
  asmGrd14: string | null
  asmGrd15: string | null
  asmGrd16: string | null
  asmGrd17: string | null
  asmGrd18: string | null
  asmGrd19: string | null
  asmGrd20: string | null
  asmGrd21: string | null
  asmGrd22: string | null
  asmGrd23: string | null
  asmGrd24: string | null
}

export interface HospitalTop5Summary {
  crtrYm: string | null
  diseaseNm1: string | null
  diseaseNm2: string | null
  diseaseNm3: string | null
  diseaseNm4: string | null
  diseaseNm5: string | null
}

export interface Hospital {
  id: number
  name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  phone: string | null
  publicCode: string | null
  department: string | null
  doctorTotalCount: number | null
  establishedDate: string | null
  mdeptSpecialistCount: number | null
  mdeptGeneralCount: number | null
  mdeptInternCount: number | null
  mdeptResidentCount: number | null
  detySpecialistCount: number | null
  cmdcSpecialistCount: number | null
  /** 평균 별점 (1~5) */
  averageRating: number | null
  /** 리뷰 개수 */
  reviewCount: number | null
  /** 심평원 병원평가정보 (있으면 객체, 없으면 null) */
  evaluation: HospitalEvaluationSummary | null

  /** 심평원 병원진료정보 Top5 (있으면 객체, 없으면 null) */
  top5: HospitalTop5Summary | null
}

export interface NearbyHospital {
  hospital: Hospital
  distanceMeters: number
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

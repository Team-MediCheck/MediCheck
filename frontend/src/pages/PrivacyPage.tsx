/** 웹 공개용 개인정보처리방침 요약 (스토어·Play 등록용) */
export function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <p className="text-sm text-emerald-700 font-medium mb-2">바로닥터 (BaroDoctor)</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">개인정보처리방침</h1>
        <div className="space-y-5 text-[15px] leading-relaxed text-gray-700">
          <p>
            바로닥터는 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.
          </p>
          <section>
            <h2 className="font-semibold text-gray-900 mb-1">수집 항목</h2>
            <p>로그인 ID, 이름(선택), 카카오 로그인 시 제공받는 식별 정보, 서비스 이용 기록, 주변 병원 검색을 위한 위치 정보(권한 허용 시)</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-1">이용 목적</h2>
            <p>회원 식별, 즐겨찾기·리뷰, 주변 병원 검색, 서비스 개선</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-1">보관</h2>
            <p>관련 법령 또는 회원 탈퇴(계정 삭제) 시까지. 위치 정보는 검색 시에만 사용하며 기기 설정에서 권한을 철회할 수 있습니다.</p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-1">데이터 출처·평가 근거</h2>
            <p>
              병원평가·진료 Top5 정보는 건강보험심사평가원(심평원)이 공개하는
              병원평가정보 및 병원진료정보조회서비스(공공데이터)를 활용합니다.
              항목별 등급 의미가 다를 수 있으며, 바로닥터는 의료기기가 아니며
              진단·처방을 제공하지 않습니다.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-gray-900 mb-1">계정·데이터 삭제</h2>
            <p>
              삭제 요청 방법과 삭제·보관 데이터는{' '}
              <a href="/account-deletion" className="text-sky-600 underline">
                계정 삭제 안내
              </a>
              를 확인해 주세요.
            </p>
          </section>
          <p className="text-sm text-gray-500 pt-4 border-t border-gray-200">
            문의: support@medicheck.life · 개발자/서비스: 바로닥터
          </p>
        </div>
      </div>
    </div>
  )
}

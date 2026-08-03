/**
 * Google Play / 스토어용 계정 삭제 안내 페이지.
 * 요구사항: 앱·개발자명, 삭제 요청 절차, 삭제·보관 데이터 명시.
 */
export function AccountDeletionPage() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14">
        <p className="text-sm text-emerald-700 font-medium mb-2">바로닥터 (BaroDoctor)</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">계정 및 데이터 삭제 요청</h1>

        <div className="space-y-6 text-[15px] leading-relaxed text-gray-700">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">1. 앱에서 바로 삭제 (권장)</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>바로닥터 앱에 로그인합니다.</li>
              <li>
                <span className="font-medium">내 정보</span> →{' '}
                <span className="font-medium">회원 탈퇴</span>를 선택합니다.
              </li>
              <li>확인 후 계정이 즉시 삭제됩니다. (즐겨찾기·리뷰 포함, 복구 불가)</li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">2. 이메일로 삭제 요청</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                앱을 사용할 수 없는 경우 아래 이메일로 계정 삭제를 요청해 주세요.
                <br />
                <a
                  href="mailto:support@medicheck.life?subject=%5B바로닥터%5D%20계정%20삭제%20요청"
                  className="text-sky-600 underline break-all"
                >
                  support@medicheck.life
                </a>
              </li>
              <li>
                메일 제목: <span className="font-medium">[바로닥터] 계정 삭제 요청</span>
              </li>
              <li>
                본문에 다음을 적어 주세요.
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>가입에 사용한 로그인 ID 또는 카카오 계정 이메일</li>
                  <li>앱에 표시된 이름(닉네임)</li>
                  <li>요청일</li>
                </ul>
              </li>
              <li>
                본인 확인 후 <strong>영업일 기준 7일 이내</strong>에 계정을 삭제합니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">3. 삭제되는 데이터</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>계정 정보 (로그인 ID, 이름, 연동된 카카오 식별 정보)</li>
              <li>즐겨찾기 병원</li>
              <li>작성한 병원 리뷰</li>
              <li>서비스 이용과 직접 관련된 계정 단위 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">4. 보관될 수 있는 데이터</h2>
            <p>
              관련 법령에 따라 일정 기간 보관이 필요한 기록(예: 고객 문의·분쟁 대응 기록)은
              법정 보관 기간 동안 분리 보관된 뒤 파기합니다. 그 외 계정 데이터는 삭제 처리 후
              복구할 수 없습니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-2">5. 계정 없이 일부 데이터만 삭제</h2>
            <p>
              현재는 계정 단위 삭제를 기본으로 지원합니다. 즐겨찾기·리뷰만 따로 삭제하려면
              위 이메일로 요청해 주시면 가능한 범위에서 처리합니다.
            </p>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t border-gray-200">
            개발자/서비스: 바로닥터 (BaroDoctor) · medicheck.life
          </p>
        </div>
      </div>
    </div>
  )
}

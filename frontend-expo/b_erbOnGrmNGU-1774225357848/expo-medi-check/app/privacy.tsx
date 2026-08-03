import { ScrollView, Text, StyleSheet } from 'react-native'
import { HIRA_ATTR_BASIS } from '@/lib/hiraAttribution'

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>개인정보처리방침</Text>
      <Text style={styles.p}>
        바로닥터는 서비스 제공을 위해 필요한 최소한의 개인정보를 처리합니다.{'\n\n'}
        • 수집 항목: 로그인 ID, 이름(선택), 카카오 로그인 시 식별 정보, 서비스 이용 기록 등{'\n'}
        • 이용 목적: 회원 식별, 즐겨찾기·리뷰 기능, 주변 병원 검색, 서비스 개선{'\n'}
        • 보관: 관련 법령 또는 회원 탈퇴 시까지{'\n'}
        • 위치 정보: 주변 병원 검색 시에만 사용되며, 설정에서 권한을 철회할 수 있습니다.
        {'\n\n'}
        [데이터 출처·평가 근거]{'\n'}
        {HIRA_ATTR_BASIS}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  p: { fontSize: 15, color: '#475569', lineHeight: 24 },
})

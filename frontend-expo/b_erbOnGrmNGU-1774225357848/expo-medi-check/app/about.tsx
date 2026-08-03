import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'

export default function AboutScreen() {
  const router = useRouter()
  const name = Constants.expoConfig?.name ?? 'MediCheck'
  const version = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="medical" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.appName}>{name}</Text>
        <Text style={styles.version}>버전 {version}</Text>
      </View>

      <Text style={styles.desc}>
        주변 병원 검색, 길찾기, 리뷰 등을 제공하는 LBS 기반 안심 병원 찾기 서비스입니다.
        {'\n\n'}
        병원평가·진료 Top5 정보는 건강보험심사평가원(심평원) 공공데이터를 활용합니다.
        바로닥터는 의료기기가 아니며 진단·처방을 제공하지 않습니다.
      </Text>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/terms')}
        >
          <Ionicons name="document-text-outline" size={22} color="#64748B" />
          <Text style={styles.linkText}>이용약관</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/privacy')}
        >
          <Ionicons name="shield-checkmark-outline" size={22} color="#64748B" />
          <Text style={styles.linkText}>개인정보처리방침</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>© MediCheck</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  version: { fontSize: 14, color: '#64748B', marginTop: 6 },
  desc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 0,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  linkText: { flex: 1, fontSize: 16, color: '#1E293B' },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 28,
  },
})

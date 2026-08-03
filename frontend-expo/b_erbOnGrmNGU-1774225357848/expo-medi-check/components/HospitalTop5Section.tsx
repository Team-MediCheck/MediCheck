import { View, Text, StyleSheet } from 'react-native'
import type { HospitalTop5Summary } from '@/types'
import { HIRA_ATTR_BASIS, HIRA_ATTR_SHORT } from '@/lib/hiraAttribution'

type Props = {
  top5: HospitalTop5Summary | null | undefined
}

export function HospitalTop5Section({ top5 }: Props) {
  const rows = top5
    ? [
        top5.diseaseNm1,
        top5.diseaseNm2,
        top5.diseaseNm3,
        top5.diseaseNm4,
        top5.diseaseNm5,
      ]
    : []

  const hasAny = rows.some((v) => !!v && v.trim().length > 0)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>상위 5개 진료과목</Text>
      <Text style={styles.subtitle}>{HIRA_ATTR_SHORT} · 병원진료정보조회서비스</Text>

      {top5?.crtrYm ? (
        <Text style={styles.meta}>기준년월 · {top5.crtrYm}</Text>
      ) : null}

      {hasAny ? (
        <View style={styles.table}>
          {rows.map((value, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.rank}>{idx + 1}위</Text>
              <Text style={styles.value}>
                {value && value.trim().length > 0 ? value : '-'}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>
          연동된 상위 5개 진료과목 정보가 없습니다. 관리자 동기화 후 다시 확인해 주세요.
        </Text>
      )}

      {hasAny ? <Text style={styles.footnote}>{HIRA_ATTR_BASIS}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  meta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  table: {
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rank: {
    width: 34,
    fontSize: 13,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  value: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  muted: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  footnote: {
    marginTop: 12,
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
})

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { HospitalEvaluationSummary } from '@/types'
import {
  getEvaluationStarScore,
  getHiraEvaluationRows,
  getHiraGradeAverageAsStarFill,
} from '@/lib/hiraEvaluation'
import { HIRA_ATTR_BASIS, HIRA_ATTR_SHORT } from '@/lib/hiraAttribution'

type Props = {
  evaluation: HospitalEvaluationSummary | null | undefined
}

function HiraStarRow({ gradeAverage }: { gradeAverage: number }) {
  const filled = getHiraGradeAverageAsStarFill(gradeAverage)
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= filled ? 'star' : 'star-outline'}
          size={18}
          color="#0284C7"
        />
      ))}
      <Text style={styles.starScoreText}>1등급이 가장 우수</Text>
    </View>
  )
}

/**
 * 심평원 병원평가정보(getHospAsmInfo1) 요약·항목별 등급
 */
export function HiraEvaluationSection({ evaluation }: Props) {
  const [rowsOpen, setRowsOpen] = useState(false)
  const [basisOpen, setBasisOpen] = useState(false)

  if (!evaluation) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>심평원 병원평가</Text>
        <Text style={styles.muted}>
          연동된 심평원 병원평가정보가 없습니다. 관리자 동기화 후 다시 확인해 주세요.
        </Text>
      </View>
    )
  }

  const score = getEvaluationStarScore(evaluation)
  const rows = getHiraEvaluationRows(evaluation)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>심평원 병원평가</Text>
      <Text style={styles.subtitle}>{HIRA_ATTR_SHORT} · 병원평가정보</Text>

      {evaluation.clCdNm ? (
        <Text style={styles.meta}>종별 · {evaluation.clCdNm}</Text>
      ) : null}

      {score != null ? (
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>항목 등급 요약</Text>
          <HiraStarRow gradeAverage={score} />
        </View>
      ) : rows.length > 0 ? (
        <Text style={styles.mutedSmall}>
          등급이 「등급제외」 등으로만 구성된 경우 숫자 요약을 표시하지 않습니다.
        </Text>
      ) : null}

      {rows.length > 0 ? (
        <View style={styles.tableWrap}>
          <Pressable
            onPress={() => setRowsOpen((v) => !v)}
            style={styles.toggleBtn}
            accessibilityRole="button"
            accessibilityState={{ expanded: rowsOpen }}
          >
            <Text style={styles.toggleText}>평가 항목 {rows.length}개</Text>
            <Ionicons
              name={rowsOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#0369A1"
            />
          </Pressable>
          {rowsOpen
            ? rows.map((row) => (
                <View key={row.key} style={styles.tableRow}>
                  <Text style={styles.tableLabel} numberOfLines={2}>
                    {row.label}
                  </Text>
                  <Text style={styles.tableValue}>{row.value}</Text>
                </View>
              ))
            : null}
        </View>
      ) : (
        <Text style={styles.muted}>표시할 세부 등급 항목이 없습니다.</Text>
      )}

      <Pressable
        onPress={() => setBasisOpen((v) => !v)}
        style={styles.basisToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: basisOpen }}
      >
        <Text style={styles.basisToggleText}>데이터 출처·평가 근거</Text>
        <Ionicons
          name={basisOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="#94A3B8"
        />
      </Pressable>
      {basisOpen ? <Text style={styles.footnote}>{HIRA_ATTR_BASIS}</Text> : null}
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
  summaryBlock: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starScoreText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  tableWrap: {
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  tableLabel: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  tableValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    minWidth: 56,
    textAlign: 'right',
  },
  muted: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
  },
  mutedSmall: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
    lineHeight: 18,
  },
  basisToggle: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  basisToggleText: {
    fontSize: 12,
    color: '#64748B',
  },
  footnote: {
    marginTop: 6,
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
})

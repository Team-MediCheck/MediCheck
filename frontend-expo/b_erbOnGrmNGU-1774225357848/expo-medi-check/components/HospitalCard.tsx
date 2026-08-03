import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Hospital } from '@/types'
import {
  countHiraEvaluationEntries,
  getEvaluationStarScore,
  getHiraGradeAverageAsStarFill,
} from '@/lib/hiraEvaluation'
import { HIRA_ATTR_SHORT } from '@/lib/hiraAttribution'

interface HospitalCardProps {
  hospital: Hospital
  distance?: number
  onPress: () => void
  isSelected?: boolean
  showFavorite?: boolean
}

export default function HospitalCard({
  hospital,
  distance,
  onPress,
  isSelected = false,
  showFavorite = false,
}: HospitalCardProps) {
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
  }

  const hiraEval = hospital.evaluation
  const hiraStarAvg =
    hiraEval != null ? getEvaluationStarScore(hiraEval) : null
  const hiraStarFill =
    hiraStarAvg != null ? getHiraGradeAverageAsStarFill(hiraStarAvg) : null
  const hiraRowCount =
    hiraEval != null ? countHiraEvaluationEntries(hiraEval) : 0
  const showHiraOnCard =
    hiraEval != null && (hiraStarAvg != null || hiraRowCount > 0)

  return (
    <TouchableOpacity
      style={[styles.container, isSelected && styles.containerSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.departmentBadge}>
          <Text style={styles.departmentText}>
            {hospital.department ?? '일반'}
          </Text>
        </View>
        {distance !== undefined && (
          <Text style={styles.distance}>{formatDistance(distance)}</Text>
        )}
        {showFavorite && (
          <Ionicons name="heart" size={18} color="#EF4444" />
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {hospital.name}
      </Text>

      <Text style={styles.address} numberOfLines={1}>
        {hospital.address ?? '-'}
      </Text>

      <View style={styles.footer}>
        <View style={styles.footerMain}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            <Text style={styles.rating}>
              {hospital.averageRating?.toFixed(1) ?? '-'}
            </Text>
            <Text style={styles.reviewCount}>
              ({hospital.reviewCount ?? 0})
            </Text>
          </View>

          {hospital.doctorTotalCount !== null && hospital.doctorTotalCount > 0 && (
            <View style={styles.doctorContainer}>
              <Ionicons name="medical-outline" size={14} color="#64748B" />
              <Text style={styles.doctorCount}>
                의사 {hospital.doctorTotalCount}명
              </Text>
            </View>
          )}
        </View>

        {showHiraOnCard ? (
          <View style={styles.hiraBlock}>
            <View style={styles.hiraRow}>
              <Ionicons name="ribbon-outline" size={14} color="#0284C7" />
              <Text style={styles.hiraLabel}>심평원</Text>
              {hiraStarFill != null ? (
                <>
                  <View style={styles.hiraStars}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons
                        key={i}
                        name={i <= hiraStarFill ? 'star' : 'star-outline'}
                        size={12}
                        color="#0284C7"
                      />
                    ))}
                  </View>
                <Text style={styles.hiraHint}>1등급이 우수</Text>
                </>
              ) : (
                <Text style={styles.hiraFallback}>등급 {hiraRowCount}항목</Text>
              )}
            </View>
            <Text style={styles.hiraAttr}>{HIRA_ATTR_SHORT}</Text>
          </View>
        ) : null}
      </View>

      {hospital.top5 && hospital.top5.diseaseNm1 && (
        <View style={styles.tags}>
          {[
            hospital.top5.diseaseNm1,
            hospital.top5.diseaseNm2,
            hospital.top5.diseaseNm3,
          ]
            .filter(Boolean)
            .slice(0, 3)
            .map((disease, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{disease}</Text>
              </View>
            ))}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  containerSelected: {
    borderColor: '#0EA5E9',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  departmentBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  departmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  distance: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '600',
    color: '#0EA5E9',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
  },
  footer: {
    gap: 8,
  },
  footerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  hiraBlock: {
    gap: 2,
  },
  hiraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  hiraLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  hiraAttr: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 18,
  },
  hiraStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginLeft: 2,
  },
  hiraHint: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 2,
  },
  hiraFallback: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  reviewCount: {
    fontSize: 12,
    color: '#94A3B8',
  },
  doctorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doctorCount: {
    fontSize: 12,
    color: '#64748B',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#475569',
  },
})

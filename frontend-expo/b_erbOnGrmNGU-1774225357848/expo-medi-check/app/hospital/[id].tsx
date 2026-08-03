import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import {
  getHospital,
  getHospitalReviews,
  addFavorite,
  removeFavorite,
  getFavorites,
} from '@/lib/api'
import ReviewModal from '@/components/ReviewModal'
import ReviewCard from '@/components/ReviewCard'
import { HiraEvaluationSection } from '@/components/HiraEvaluationSection'
import { HospitalTop5Section } from '@/components/HospitalTop5Section'
import {
  getEvaluationStarScore,
  getHiraEvaluationRows,
} from '@/lib/hiraEvaluation'

export default function HospitalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [showReviewModal, setShowReviewModal] = useState(false)

  const hospitalId = Number(id)

  const { data: hospital, isLoading } = useQuery({
    queryKey: ['hospital', hospitalId],
    queryFn: () => getHospital(hospitalId),
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', hospitalId],
    queryFn: () => getHospitalReviews(hospitalId),
  })

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: !!user,
  })

  const isFavorite = favorites?.some((h) => h.id === hospitalId) ?? false

  const favoriteMutation = useMutation({
    mutationFn: () =>
      isFavorite ? removeFavorite(hospitalId) : addFavorite(hospitalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const handleFavoriteToggle = useCallback(() => {
    if (!user) {
      Alert.alert('로그인 필요', '즐겨찾기는 로그인 후 이용할 수 있습니다.', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => router.push('/login') },
      ])
      return
    }
    favoriteMutation.mutate()
  }, [user, favoriteMutation, router])

  const handleCall = useCallback(() => {
    if (hospital?.phone) {
      Linking.openURL(`tel:${hospital.phone}`)
    }
  }, [hospital?.phone])

  const handleOpenMap = useCallback(() => {
    if (hospital?.latitude && hospital?.longitude) {
      const url = `https://map.kakao.com/link/to/${hospital.name},${hospital.latitude},${hospital.longitude}`
      Linking.openURL(url)
    }
  }, [hospital])

  const handleWriteReview = useCallback(() => {
    if (!user) {
      Alert.alert('로그인 필요', '리뷰 작성은 로그인 후 이용할 수 있습니다.', [
        { text: '취소', style: 'cancel' },
        { text: '로그인', onPress: () => router.push('/login') },
      ])
      return
    }
    setShowReviewModal(true)
  }, [user, router])

  if (isLoading || !hospital) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    )
  }

  const hiraEval = hospital.evaluation
  const hiraStarScore = getEvaluationStarScore(hiraEval)
  const hiraRowCount = hiraEval ? getHiraEvaluationRows(hiraEval).length : 0

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerInfo}>
              <Text style={styles.department}>{hospital.department ?? '일반'}</Text>
              <Text style={styles.name}>{hospital.name}</Text>
            </View>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={handleFavoriteToggle}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={28}
                color={isFavorite ? '#EF4444' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={20} color="#FBBF24" />
            <Text style={styles.rating}>
              {hospital.averageRating?.toFixed(1) ?? '-'}
            </Text>
            <Text style={styles.reviewCount}>
              리뷰 {hospital.reviewCount ?? 0}개
            </Text>
          </View>

          <View style={styles.hiraHeaderRow}>
            <Ionicons name="ribbon-outline" size={17} color="#0284C7" />
            <Text style={styles.hiraHeaderLabel}>심평원 병원평가</Text>
            {hiraEval ? (
              hiraStarScore != null ? (
                <View style={styles.hiraHeaderStars}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Ionicons
                      key={i}
                      name={i <= hiraStarScore ? 'star' : 'star-outline'}
                      size={14}
                      color="#0284C7"
                    />
                  ))}
                </View>
              ) : hiraRowCount > 0 ? (
                <Text style={styles.hiraHeaderSub}>항목별 등급 · 아래에서 확인</Text>
              ) : (
                <Text style={styles.hiraHeaderSub}>정보 있음 · 아래 참고</Text>
              )
            ) : (
              <Text style={styles.hiraHeaderMuted}>연동 정보 없음</Text>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Ionicons name="call" size={24} color="#0EA5E9" />
            <Text style={styles.actionText}>전화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenMap}>
            <Ionicons name="navigate" size={24} color="#0EA5E9" />
            <Text style={styles.actionText}>길찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleWriteReview}>
            <Ionicons name="create" size={24} color="#0EA5E9" />
            <Text style={styles.actionText}>리뷰</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>병원 정보</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{hospital.address ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>{hospital.phone ?? '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="medical-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              의료진 {hospital.doctorTotalCount ?? 0}명
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <Text style={styles.infoText}>
              개업일 {hospital.establishedDate ?? '-'}
            </Text>
          </View>
        </View>

        <HospitalTop5Section top5={hospital.top5} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>리뷰</Text>
            <TouchableOpacity onPress={handleWriteReview}>
              <Text style={styles.writeReviewLink}>작성하기</Text>
            </TouchableOpacity>
          </View>

          {reviews?.content && reviews.content.length > 0 ? (
            reviews.content.slice(0, 3).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))
          ) : (
            <View style={styles.emptyReviews}>
              <Ionicons name="chatbubble-outline" size={32} color="#CBD5E1" />
              <Text style={styles.emptyText}>아직 리뷰가 없습니다</Text>
            </View>
          )}
        </View>

        <HiraEvaluationSection evaluation={hospital.evaluation} />
      </ScrollView>

      <ReviewModal
        visible={showReviewModal}
        hospitalId={hospitalId}
        onClose={() => setShowReviewModal(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  department: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '600',
    marginBottom: 4,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  favoriteButton: {
    padding: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  rating: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  reviewCount: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
  },
  hiraHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    gap: 6,
  },
  hiraHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C4A6E',
  },
  hiraHeaderStars: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 120,
  },
  hiraHeaderScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  hiraHeaderSub: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1,
  },
  hiraHeaderMuted: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#64748B',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  writeReviewLink: {
    fontSize: 14,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  emptyReviews: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
})

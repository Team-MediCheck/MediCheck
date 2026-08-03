import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchHospitalReviews,
  fetchMyReview,
  submitHospitalReview,
  deleteMyReview,
  type HospitalReview,
} from '../api/hospitals'
import { useAuth } from '../contexts/AuthContext'

interface HospitalReviewModalProps {
  hospitalId: number
  hospitalName: string
  onClose: () => void
}

export function HospitalReviewModal({
  hospitalId,
  hospitalName,
  onClose,
}: HospitalReviewModalProps) {
  const { token } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const { data: reviewsPage, isLoading: reviewsLoading } = useQuery({
    queryKey: ['hospitalReviews', hospitalId, page],
    queryFn: () => fetchHospitalReviews(hospitalId, page, 10),
    enabled: !!hospitalId,
  })

  const { data: myReview, refetch: refetchMyReview } = useQuery({
    queryKey: ['myReview', hospitalId],
    queryFn: () => (token ? fetchMyReview(token, hospitalId) : Promise.resolve(null)),
    enabled: !!hospitalId && !!token,
  })

  const submitMutation = useMutation({
    mutationFn: () =>
      token
        ? submitHospitalReview(token, hospitalId, rating, comment)
        : Promise.reject(new Error('로그인이 필요합니다.')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalReviews', hospitalId] })
      queryClient.invalidateQueries({ queryKey: ['myReview', hospitalId] })
      queryClient.invalidateQueries({ queryKey: ['nearbyHospitals'] })
      refetchMyReview()
      setComment('')
      if (myReview) setRating(myReview.rating)
      else setRating(5)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      token ? deleteMyReview(token, hospitalId) : Promise.reject(new Error('로그인이 필요합니다.')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitalReviews', hospitalId] })
      queryClient.invalidateQueries({ queryKey: ['myReview', hospitalId] })
      queryClient.invalidateQueries({ queryKey: ['nearbyHospitals'] })
      refetchMyReview()
      setRating(5)
      setComment('')
    },
  })

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating)
      setComment(myReview.comment ?? '')
    } else {
      setRating(5)
      setComment('')
    }
  }, [myReview])

  const totalPages = reviewsPage?.totalPages ?? 0
  const content = reviewsPage?.content ?? []

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="병원 리뷰"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={handleOverlayKeyDown}
        aria-label="모달 닫기"
      />
      <div
        className="relative flex max-h-[min(85dvh,85vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-gray-800">{hospitalName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 [-webkit-overflow-scrolling:touch]">
          {token && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                {myReview ? '내 리뷰 수정' : '리뷰 작성'}
              </p>
              <div className="mb-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    className={`text-xl ${rating >= r ? 'text-amber-400' : 'text-gray-300'}`}
                    aria-label={`${r}점`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="한 줄 코멘트 (선택)"
                className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                rows={2}
                maxLength={500}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="flex-1 rounded-lg bg-sky-500 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                >
                  {submitMutation.isPending ? '저장 중…' : myReview ? '수정' : '등록'}
                </button>
                {myReview && (
                  <button
                    type="button"
                    onClick={() =>
                      window.confirm('리뷰를 삭제할까요?') && deleteMutation.mutate()
                    }
                    disabled={deleteMutation.isPending}
                    className="rounded-lg border border-red-200 py-2 px-3 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                )}
              </div>
              {(submitMutation.error || deleteMutation.error) && (
                <p className="mt-1 text-xs text-red-600">
                  {submitMutation.error instanceof Error
                    ? submitMutation.error.message
                    : deleteMutation.error instanceof Error
                      ? deleteMutation.error.message
                      : '오류가 발생했습니다.'}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">리뷰 목록</p>
            {reviewsLoading ? (
              <div className="py-6 text-center text-sm text-gray-400">로딩 중…</div>
            ) : content.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                아직 리뷰가 없습니다.
                {!token && ' 로그인 후 첫 리뷰를 남겨 보세요.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {content.map((r: HospitalReview) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-gray-100 bg-white p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">{r.userDisplayName}</span>
                      <span className="text-amber-500">
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-gray-600">{r.comment}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {totalPages > 1 && (
              <div className="mt-3 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded border border-gray-200 px-3 py-1 text-sm disabled:opacity-50"
                >
                  이전
                </button>
                <span className="py-1 text-sm text-gray-500">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded border border-gray-200 px-3 py-1 text-sm disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { deleteAccount } from '@/lib/api'

function profileInitial(name: string, loginId: string): string {
  const s = (name || loginId).trim()
  if (!s) return '?'
  const ch = s.charAt(0)
  return /[A-Za-z]/.test(ch) ? ch.toUpperCase() : ch
}

export default function ProfileScreen() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout()
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '계정을 삭제하면 즐겨찾기와 작성한 리뷰가 함께 삭제되며 복구할 수 없습니다. 계속할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴',
          style: 'destructive',
          onPress: () => {
            Alert.alert('최종 확인', '정말로 계정을 삭제하시겠습니까?', [
              { text: '취소', style: 'cancel' },
              {
                text: '계정 삭제',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount()
                    await logout()
                    Alert.alert('탈퇴 완료', '계정이 삭제되었습니다.')
                  } catch (e) {
                    Alert.alert(
                      '탈퇴 실패',
                      e instanceof Error ? e.message : '계정 삭제에 실패했습니다.'
                    )
                  }
                },
              },
            ])
          },
        },
      ]
    )
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.guestHeader}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={40} color="#94A3B8" />
          </View>
          <Text style={styles.guestTitle}>로그인이 필요합니다</Text>
          <Text style={styles.guestDescription}>
            로그인하고 더 많은 기능을 이용해 보세요
          </Text>
        </View>

        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signupButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.signupButtonText}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/about')}
          >
            <Ionicons name="information-circle-outline" size={24} color="#64748B" />
            <Text style={styles.menuText}>앱 정보</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/terms')}
          >
            <Ionicons name="document-text-outline" size={24} color="#64748B" />
            <Text style={styles.menuText}>이용약관</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#64748B" />
            <Text style={styles.menuText}>개인정보처리방침</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>바로닥터 v{appVersion}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profileInitial(user.name ?? '', user.loginId)}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name || user.loginId}</Text>
        <Text style={styles.userId}>{user.loginId}</Text>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/favorites')}
        >
          <Ionicons name="heart-outline" size={24} color="#64748B" />
          <Text style={styles.menuText}>즐겨찾기</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/my-reviews')}
        >
          <Ionicons name="create-outline" size={24} color="#64748B" />
          <Text style={styles.menuText}>내 리뷰</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/notification-settings')}
        >
          <Ionicons name="notifications-outline" size={24} color="#64748B" />
          <Text style={styles.menuText}>알림 설정</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/about')}
        >
          <Ionicons name="information-circle-outline" size={24} color="#64748B" />
          <Text style={styles.menuText}>앱 정보</Text>
          <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
        </TouchableOpacity>
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={[styles.menuText, styles.logoutText]}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
          <Text style={[styles.menuText, styles.logoutText]}>회원 탈퇴</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>바로닥터 v{appVersion}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  guestHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  guestDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  authButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  loginButton: {
    flex: 1,
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signupButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  userHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  userId: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  logoutText: {
    color: '#EF4444',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 24,
    marginBottom: 8,
  },
})

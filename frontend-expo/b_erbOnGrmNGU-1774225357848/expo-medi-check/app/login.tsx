import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Crypto from 'expo-crypto'
import * as AuthSession from 'expo-auth-session'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useAuthStore } from '@/store/authStore'
import { login, getMe, loginWithKakao } from '@/lib/api'

type Extra = {
  kakaoRestApiKey?: string
}

function getKakaoRestApiKey(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  return (extra?.kakaoRestApiKey ?? '').trim()
}

const KAKAO_OAUTH_CALLBACK_PATH = '/oauth/kakao/callback'

/**
 * Standalone / Dev Client 전용. 호스트 `app`으로 두어 `new URL(...)` 파싱 시 pathname 이 `/oauth/kakao/callback` 이 되게 함.
 * 카카오 디벨로퍼스·백엔드 KAKAO_OAUTH_ALLOWED_REDIRECT_URIS 에 문자 그대로 등록 필요.
 */
const KAKAO_OAUTH_NATIVE_APP_REDIRECT_URI = 'medicheck://app/oauth/kakao/callback'

/**
 * EXPO_PUBLIC_API_URL(또는 extra.apiUrl)이 `https://도메인/api`일 때, 웹 SPA와 동일한 호스트를 뽑는다.
 * 실기기 카카오 로그인은 `https://auth.expo.io` 프록시가 콜백 후 앱으로 넘기는 단계에서 자주 깨지므로,
 * 운영 HTTPS 도메인이면 **웹과 같은** `/oauth/kakao/callback` 을 쓴다.
 */
function resolvePublicHttpsOriginFromApiBase(): string | null {
  const fromEnv =
    typeof process.env.EXPO_PUBLIC_API_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_URL.trim()
      : ''
  const fromExtra = (
    Constants.expoConfig?.extra as { apiUrl?: string } | undefined
  )?.apiUrl?.trim() ?? ''
  const raw = fromEnv || fromExtra
  if (!raw) return null
  const base = raw.replace(/\/$/, '').replace(/\/api\/?$/i, '')
  if (!/^https:\/\//i.test(base)) return null
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(base)) return null
  return base
}

/**
 * API는 `www`인데 브라우저/카카오 콜백은 apex만 쓰는 경우가 많음.
 * iOS 17.4+ `ASWebAuthenticationSession`은 redirect_uri 호스트와 실제 콜백 호스트가 같아야 세션이 끝남(안 맞으면 SPA만 뜨고 닫을 때 cancel).
 */
function getKakaoOAuthRedirectFromEnvOverride(): string | null {
  const raw =
    typeof process.env.EXPO_PUBLIC_KAKAO_OAUTH_REDIRECT_ORIGIN === 'string'
      ? process.env.EXPO_PUBLIC_KAKAO_OAUTH_REDIRECT_ORIGIN.trim()
      : ''
  if (!raw) return null
  const base = raw.replace(/\/$/, '')
  if (!/^https:\/\//i.test(base)) return null
  if (/localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(base)) return null
  return `${base}${KAKAO_OAUTH_CALLBACK_PATH}`
}

/**
 * Expo AuthSession 프록시 base (`https://auth.expo.io/@owner/slug`).
 * `Constants.expoConfig.originalFullName` 기준이라 `getRedirectUrl()` 우선(카카오 등록 URI와 동일해야 함).
 */
function getAuthExpoIoRedirectUri(): string {
  try {
    return AuthSession.getRedirectUrl()
  } catch {
    const owner = Constants.expoConfig?.owner
    const slug = Constants.expoConfig?.slug
    if (typeof owner === 'string' && owner.trim() && typeof slug === 'string' && slug.trim()) {
      return `https://auth.expo.io/@${owner.trim()}/${slug.trim()}`
    }
    return 'https://auth.expo.io/@snowrabbit/medi-check'
  }
}

/**
 * Expo Go + 운영 HTTPS: ASWebAuthenticationSession / openAuthSessionAsync 가 콜백을 안정적으로 못 넘길 때 사용.
 * openBrowserAsync + 운영 HTTPS 콜백 HTML에서 exp:// 로 넘긴 뒤 Linking 으로 code 수신.
 */
async function openKakaoOAuthWithBrowserAndLinking(
  kakaoAuthorizeUrl: string,
  expoReturnUrl: string
): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  const returnPrefix = expoReturnUrl.split('?')[0]
  return await new Promise((resolve) => {
    let settled = false
    let cancelTimer: ReturnType<typeof setTimeout> | undefined

    const finishCancel = () => {
      if (settled) return
      settled = true
      sub.remove()
      resolve({ type: WebBrowser.WebBrowserResultType.CANCEL })
    }

    const sub = Linking.addEventListener('url', (e) => {
      const url = e.url
      if (!url || (!url.includes('code=') && !url.includes('error='))) return
      if (!url.startsWith(returnPrefix)) return
      if (settled) return
      if (cancelTimer) clearTimeout(cancelTimer)
      settled = true
      sub.remove()
      void Promise.resolve(WebBrowser.dismissBrowser()).catch(() => {})
      resolve({ type: 'success', url })
    })

    /**
     * Android: 브라우저가 닫힐 때 openBrowserAsync Promise 가 Linking(url) 보다 먼저 이행되면
     * 곧바로 CANCEL 이 되어 카카오 화면도 못 보고 앱으로 돌아가는 현상이 난다.
     * CANCEL 은 짧게 미루어 딥링크를 먼저 처리하게 한다.
     */
    const cancelDelayMs = Platform.OS === 'android' ? 300 : 100

    void WebBrowser.openBrowserAsync(kakaoAuthorizeUrl)
      .then(() => {
        cancelTimer = setTimeout(finishCancel, cancelDelayMs)
      })
      .catch(() => {
        if (cancelTimer) clearTimeout(cancelTimer)
        finishCancel()
      })
  })
}

/**
 * 카카오 로그인 redirect_uri — 카카오 콘솔은 http(s)만 허용(exp:// 불가).
 */
function getKakaoOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ path: 'oauth/kakao/callback' })
  }
  const envRedirect = getKakaoOAuthRedirectFromEnvOverride()
  if (envRedirect) {
    return envRedirect
  }
  /**
   * Expo Go(StoreClient)는 exp:// redirect 만 나와 카카오에 등록하기 어렵다 → https 콜백 유지.
   * Standalone / Dev Client(Bare)는 앱 스킴으로 돌려 iOS ASWebAuthenticationSession 이 https SPA 로드 후에도
   * 콜백을 앱에 넘기며 시트가 닫히도록 한다.
   */
  const exec = Constants.executionEnvironment
  if (
    exec === ExecutionEnvironment.Standalone ||
    exec === ExecutionEnvironment.Bare
  ) {
    return AuthSession.makeRedirectUri({
      native: KAKAO_OAUTH_NATIVE_APP_REDIRECT_URI,
      scheme: 'medicheck',
      path: 'oauth/kakao/callback',
    })
  }
  const publicOrigin = resolvePublicHttpsOriginFromApiBase()
  if (publicOrigin) {
    return `${publicOrigin}${KAKAO_OAUTH_CALLBACK_PATH}`
  }
  return getAuthExpoIoRedirectUri()
}

/** Expo 인가 요청에 붙이는 state 접두사 — 웹 KakaoCallbackPage와 동일 문자열(접두)로 인앱 여부 판별 */
const KAKAO_OAUTH_EXPO_STATE_PREFIX = 'medichek_expo_webauth'

/** 카카오 리다이렉트 URL에서 code / state / error 파싱 (커스텀 스킴 등 URL 생성기 호환) */
function parseKakaoCallbackUrl(url: string): {
  code?: string
  state?: string
  error?: string
  errorDescription?: string
} {
  try {
    const u = new URL(url)
    return {
      code: u.searchParams.get('code') ?? undefined,
      state: u.searchParams.get('state') ?? undefined,
      error: u.searchParams.get('error') ?? undefined,
      errorDescription: u.searchParams.get('error_description') ?? undefined,
    }
  } catch {
    const q = url.split('?')[1]
    if (!q) return {}
    const params = new URLSearchParams(q.split('#')[0])
    return {
      code: params.get('code') ?? undefined,
      state: params.get('state') ?? undefined,
      error: params.get('error') ?? undefined,
      errorDescription: params.get('error_description') ?? undefined,
    }
  }
}

export default function LoginScreen() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const loginMutation = useMutation({
    mutationFn: () => login({ loginId, password }),
    onSuccess: async (data) => {
      const user = await getMe(data.token)
      if (!user) {
        Alert.alert('오류', '사용자 정보를 불러올 수 없습니다.')
        return
      }
      await setAuth(user, data.token)
      router.back()
    },
    onError: (err: Error) => {
      Alert.alert(
        '로그인 실패',
        err.message || '아이디 또는 비밀번호를 확인해 주세요.'
      )
    },
  })

  const kakaoMutation = useMutation({
    mutationFn: async () => {
      const kakaoRestApiKey = getKakaoRestApiKey()
      if (!kakaoRestApiKey) {
        throw new Error(
          '카카오 REST API 키가 없습니다. frontend/.env의 VITE_KAKAO_REST_API_KEY 또는 EXPO_PUBLIC_KAKAO_REST_API_KEY를 설정한 뒤 Metro를 재시작하세요.'
        )
      }

      const redirectUri = getKakaoOAuthRedirectUri()
      const exec = Constants.executionEnvironment

      if (
        exec === ExecutionEnvironment.StoreClient &&
        redirectUri.includes('auth.expo.io')
      ) {
        throw new Error(
          'Expo Go에서는 auth.expo.io 카카오 로그인을 쓸 수 없습니다. .env에 EXPO_PUBLIC_KAKAO_OAUTH_REDIRECT_ORIGIN=https://medicheck.life 를 설정하고, 카카오·백엔드에 동일한 redirect URI(https://medicheck.life/oauth/kakao/callback)를 등록하세요. (스토어/개발 빌드는 medicheck:// 스킴을 사용합니다.)'
        )
      }

      /** 운영 HTTPS 콜백에서는 브라우저+Linking+정적 HTML 브리지를 사용해 Expo Go/Standalone 모두 콜백 전달을 안정화한다. */
      const useHttpsBrowserBridge =
        redirectUri.startsWith('https://') &&
        !redirectUri.includes('auth.expo.io')

      /** `getDefaultReturnUrl()` 은 `/--/expo-auth-session` 이라 expo-router 에 매칭 라우트가 없어 Unmatched Route 가 난다 */
      const expoReturnUrl = Linking.createURL('/login')
      const oauthState = useHttpsBrowserBridge
        ? `${KAKAO_OAUTH_EXPO_STATE_PREFIX}__${encodeURIComponent(expoReturnUrl)}__${await Crypto.randomUUID()}`
        : `${KAKAO_OAUTH_EXPO_STATE_PREFIX}.${await Crypto.randomUUID()}`

      const authUrl =
        'https://kauth.kakao.com/oauth/authorize?' +
        new URLSearchParams({
          client_id: kakaoRestApiKey,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: oauthState,
        }).toString()

      const result = useHttpsBrowserBridge
        ? await openKakaoOAuthWithBrowserAndLinking(authUrl, expoReturnUrl)
        : await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new Error('카카오 로그인이 취소되었습니다.')
      }
      if (result.type !== 'success') {
        throw new Error('카카오 로그인을 완료할 수 없습니다.')
      }

      const { code, state: returnedState, error, errorDescription } =
        parseKakaoCallbackUrl(result.url)
      if (error) {
        throw new Error(
          errorDescription || error || '카카오 인증에 실패했습니다.'
        )
      }
      if (!code) {
        throw new Error(
          '카카오 인가 코드가 없습니다. 카카오 콘솔의 Redirect URI가 앱과 동일한지 확인하세요.'
        )
      }
      if (returnedState !== oauthState) {
        throw new Error(
          '카카오 OAuth state가 일치하지 않습니다. 다시 시도해 주세요.'
        )
      }

      return loginWithKakao(code, redirectUri)
    },
    onSuccess: async (data) => {
      const user = await getMe(data.token)
      if (!user) {
        Alert.alert('오류', '사용자 정보를 불러올 수 없습니다.')
        return
      }
      await setAuth(user, data.token)
      router.back()
    },
    onError: (err: Error) => {
      Alert.alert('카카오 로그인 실패', err.message || '다시 시도해 주세요.')
    },
  })

  const handleLogin = () => {
    if (!loginId.trim()) {
      Alert.alert('알림', '아이디를 입력해 주세요.')
      return
    }
    if (!password.trim()) {
      Alert.alert('알림', '비밀번호를 입력해 주세요.')
      return
    }
    loginMutation.mutate()
  }

  const handleKakaoLogin = () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        '안내',
        'Expo 웹에서는 카카오 리다이렉트가 제한될 수 있습니다. Vite 웹(frontend) 로그인 또는 iOS/Android 앱을 이용해 주세요.'
      )
      return
    }
    kakaoMutation.mutate()
  }

  const kakaoBusy = kakaoMutation.isPending

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="medical" size={40} color="#0EA5E9" />
          </View>
          <Text style={styles.title}>MediCheck</Text>
          <Text style={styles.subtitle}>내 주변 안심 병원 찾기</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="아이디"
              placeholderTextColor="#94A3B8"
              value={loginId}
              onChangeText={setLoginId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loginMutation.isPending && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.kakaoButton, kakaoBusy && styles.buttonDisabled]}
            onPress={handleKakaoLogin}
            disabled={kakaoBusy}
          >
            {kakaoBusy ? (
              <ActivityIndicator color="#3C1E1E" />
            ) : (
              <Text style={styles.kakaoButtonText}>카카오로 로그인</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>계정이 없으신가요?</Text>
          <TouchableOpacity onPress={() => router.replace('/signup')}>
            <Text style={styles.signupLink}>회원가입</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1E293B',
  },
  loginButton: {
    backgroundColor: '#0EA5E9',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kakaoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C1E1E',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0EA5E9',
  },
})

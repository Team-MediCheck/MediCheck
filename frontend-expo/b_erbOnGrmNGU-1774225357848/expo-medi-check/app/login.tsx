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
import {
  login as kakaoNativeLogin,
  loginWithKakaoAccount as kakaoNativeLoginWithKakaoAccount,
} from '@react-native-seoul/kakao-login'
import { login, getMe, loginWithKakao, loginWithKakaoNativeAccessToken } from '@/lib/api'

type Extra = {
  kakaoRestApiKey?: string
}

function getKakaoRestApiKey(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined
  return (extra?.kakaoRestApiKey ?? '').trim()
}

const KAKAO_OAUTH_CALLBACK_PATH = '/oauth/kakao/callback'
const ANDROID_OAUTH_CANCEL_DELAY_MS = 1500
const IOS_OAUTH_CANCEL_DELAY_MS = 300
const DEBUG_KAKAO_OAUTH = true
const USE_ANDROID_KAKAO_NATIVE_SDK = true

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
  if (DEBUG_KAKAO_OAUTH) {
    console.log('[KAKAO_OAUTH] openBrowserAsync start', {
      kakaoAuthorizeUrl,
      expoReturnUrl,
    })
  }
  const returnPrefix = expoReturnUrl.split('?')[0]
  return await new Promise((resolve) => {
    let settled = false
    let cancelTimer: ReturnType<typeof setTimeout> | undefined

    const finishCancel = () => {
      if (settled) return
      // 일부 기기에서는 Linking 이벤트가 손실되고 initialURL만 남는 경우가 있어 마지막으로 확인한다.
      void Linking.getInitialURL()
        .then((initialUrl) => {
          if (
            !settled &&
            initialUrl &&
            initialUrl.startsWith(returnPrefix) &&
            (initialUrl.includes('code=') || initialUrl.includes('error='))
          ) {
            settled = true
            sub.remove()
            resolve({ type: 'success', url: initialUrl })
            return
          }
          if (settled) return
          settled = true
          sub.remove()
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] openBrowserAsync cancel timeout', {
              returnPrefix,
              initialUrl,
            })
          }
          resolve({ type: WebBrowser.WebBrowserResultType.CANCEL })
        })
        .catch(() => {
          if (settled) return
          settled = true
          sub.remove()
          resolve({ type: WebBrowser.WebBrowserResultType.CANCEL })
        })
    }

    const sub = Linking.addEventListener('url', (e) => {
      const url = e.url
      if (!url || (!url.includes('code=') && !url.includes('error='))) return
      if (!url.startsWith(returnPrefix)) return
      if (settled) return
      if (DEBUG_KAKAO_OAUTH) {
        console.log('[KAKAO_OAUTH] Linking url event received', { url })
      }
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
    // 일부 Android 기기/네트워크에서는 딥링크 이벤트가 늦게 도착해 cancel 오탐이 나므로 여유를 둔다.
    const cancelDelayMs = Platform.OS === 'android' ? 5000 : IOS_OAUTH_CANCEL_DELAY_MS

    void WebBrowser.openBrowserAsync(kakaoAuthorizeUrl)
      .then(() => {
        if (DEBUG_KAKAO_OAUTH) {
          console.log('[KAKAO_OAUTH] openBrowserAsync resolved')
        }
        cancelTimer = setTimeout(finishCancel, cancelDelayMs)
      })
      .catch(() => {
        if (DEBUG_KAKAO_OAUTH) {
          console.log('[KAKAO_OAUTH] openBrowserAsync rejected')
        }
        if (cancelTimer) clearTimeout(cancelTimer)
        finishCancel()
      })
  })
}

/**
 * openAuthSessionAsync 결과가 cancel/dismiss 여도 딥링크가 늦게 도착하는 Android 레이스를 보정한다.
 */
async function openKakaoOAuthWithAuthSessionAndLinkingFallback(
  kakaoAuthorizeUrl: string,
  redirectUri: string
): Promise<WebBrowser.WebBrowserAuthSessionResult> {
  return await new Promise((resolve) => {
    let settled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    let pendingDeepLinkUrl: string | null = null

    const finish = (result: WebBrowser.WebBrowserAuthSessionResult) => {
      if (settled) return
      settled = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
      sub.remove()
      resolve(result)
    }

    const sub = Linking.addEventListener('url', (e) => {
      const url = e.url
      if (!isLikelyKakaoCallbackUrl(url, redirectUri)) return
      pendingDeepLinkUrl = url
      if (DEBUG_KAKAO_OAUTH) {
        console.log('[KAKAO_OAUTH] authSession Linking url event received', { url })
      }
    })

    void WebBrowser.openAuthSessionAsync(kakaoAuthorizeUrl, redirectUri)
      .then((result) => {
        if (result.type === 'success') {
          finish(result)
          return
        }

        // Android에서 dismiss/cancel 직후 딥링크가 도착하는 케이스를 짧게 대기한다.
        fallbackTimer = setTimeout(() => {
          if (pendingDeepLinkUrl) {
            finish({ type: 'success', url: pendingDeepLinkUrl })
            return
          }
          finish(result)
        }, Platform.OS === 'android' ? 1500 : 300)
      })
      .catch(() => {
        finish({ type: WebBrowser.WebBrowserResultType.CANCEL })
      })
  })
}

function isLikelyKakaoCallbackUrl(url: string, redirectUri: string): boolean {
  if (!url || (!url.includes('code=') && !url.includes('error='))) return false
  if (url.startsWith(redirectUri)) return true
  // 기기/브라우저별로 host(app) 누락 등 URI 형태가 달라질 수 있어 경로 기준으로 보수적으로 허용.
  return /oauth\/kakao\/callback/i.test(url)
}

/**
 * 카카오 로그인 redirect_uri — 카카오 콘솔은 http(s)만 허용(exp:// 불가).
 */
function getKakaoOAuthRedirectUri(): string {
  if (Platform.OS === 'web') {
    return AuthSession.makeRedirectUri({ path: 'oauth/kakao/callback' })
  }
  /**
   * Expo Go(StoreClient)는 exp:// redirect 만 나와 카카오에 등록하기 어렵다 → https 콜백 유지.
   * Standalone / Dev Client(Bare)는 앱 스킴으로 돌려 iOS ASWebAuthenticationSession 이 https SPA 로드 후에도
   * 콜백을 앱에 넘기며 시트가 닫히도록 한다.
   */
  const exec = Constants.executionEnvironment
  const shouldUseNativeRedirectForStandalone =
    (exec === ExecutionEnvironment.Standalone || exec === ExecutionEnvironment.Bare) &&
    (Platform.OS !== 'android' || USE_ANDROID_KAKAO_NATIVE_SDK)

  if (shouldUseNativeRedirectForStandalone) {
    return AuthSession.makeRedirectUri({
      native: KAKAO_OAUTH_NATIVE_APP_REDIRECT_URI,
      scheme: 'medicheck',
      path: 'oauth/kakao/callback',
    })
  }
  const envRedirect = getKakaoOAuthRedirectFromEnvOverride()
  if (envRedirect) {
    return envRedirect
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

function getAlternateWwwRedirectUri(redirectUri: string): string | null {
  try {
    const u = new URL(redirectUri)
    if (u.protocol !== 'https:') return null
    if (u.hostname.startsWith('www.')) {
      u.hostname = u.hostname.replace(/^www\./, '')
      return u.toString()
    }
    u.hostname = `www.${u.hostname}`
    return u.toString()
  } catch {
    return null
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
      if (Platform.OS === 'android' && USE_ANDROID_KAKAO_NATIVE_SDK) {
        const loginWithNativeToken = async (accessToken: string) => {
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] before backend loginWithKakaoNativeAccessToken')
          }
          const response = await loginWithKakaoNativeAccessToken(accessToken)
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] after backend loginWithKakaoNativeAccessToken', {
              hasToken: Boolean(response?.token),
            })
          }
          return response
        }

        const getNativeAccessTokenOrThrow = async (
          strategy: 'talk' | 'account'
        ): Promise<string> => {
          const strategyLabel = strategy === 'talk' ? 'kakaoTalk' : 'kakaoAccount'
          const loginFn =
            strategy === 'talk' ? kakaoNativeLogin : kakaoNativeLoginWithKakaoAccount
          const token = await Promise.race([
            loginFn(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`카카오 네이티브 로그인 응답 타임아웃(5s) - ${strategyLabel}`)
                  ),
                5000
              )
            ),
          ])
          const accessToken = token?.accessToken?.trim()
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] native kakao login response', {
              strategy: strategyLabel,
              hasAccessToken: Boolean(accessToken),
              accessTokenLength: accessToken?.length ?? 0,
            })
          }
          if (!accessToken) {
            throw new Error(`카카오 네이티브 로그인 토큰이 비어 있습니다. (${strategyLabel})`)
          }
          return accessToken
        }

        try {
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] native kakao login start')
          }
          const accessToken = await getNativeAccessTokenOrThrow('talk')
          return await loginWithNativeToken(accessToken)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const shouldFallbackToKakaoAccount =
            /user cancelled\.?/i.test(errorMessage) ||
            /cancel/i.test(errorMessage)

          if (shouldFallbackToKakaoAccount) {
            if (DEBUG_KAKAO_OAUTH) {
              console.log('[KAKAO_OAUTH] talk login cancelled; fallback to kakao account login', {
                errorMessage,
              })
            }
            try {
              const accountAccessToken = await getNativeAccessTokenOrThrow('account')
              return await loginWithNativeToken(accountAccessToken)
            } catch (accountError) {
              const accountErrorMessage =
                accountError instanceof Error ? accountError.message : String(accountError)
              if (DEBUG_KAKAO_OAUTH) {
                console.log('[KAKAO_OAUTH] kakao account fallback failed', {
                  accountErrorMessage,
                  accountError,
                })
                Alert.alert('Kakao Native Debug Error', accountErrorMessage)
              }
              throw accountError instanceof Error
                ? accountError
                : new Error(accountErrorMessage)
            }
          }

          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] native kakao login failed', {
              errorMessage,
              error,
            })
            Alert.alert('Kakao Native Debug Error', errorMessage)
          }
          throw error instanceof Error ? error : new Error(errorMessage)
        }
      }

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

      /**
       * HTTPS redirect_uri 일 때 nginx 가 `state` 접두어에 따라 `expo-kakao-oauth.html` 로 rewrite 해
       * `medicheck://`(또는 Expo Go 의 `exp://`)로 code 를 넘긴다. StoreClient 전용으로 두면 Standalone 은
       * SPA 콜백만 뜨고 `openAuthSessionAsync` 가 URL 을 앱에 넘기지 못한 채 멈추는 경우가 많다(Android).
       */
      const useHttpsBrowserBridge =
        Platform.OS === 'ios' &&
        redirectUri.startsWith('https://') &&
        !redirectUri.includes('auth.expo.io')

      /** `getDefaultReturnUrl()` 은 `/--/expo-auth-session` 이라 expo-router 에 매칭 라우트가 없어 Unmatched Route 가 난다 */
      const expoReturnUrl = Linking.createURL('/login')
      const runAuth = async (targetRedirectUri: string) => {
        const oauthState = useHttpsBrowserBridge
          ? `${KAKAO_OAUTH_EXPO_STATE_PREFIX}__${encodeURIComponent(expoReturnUrl)}__${await Crypto.randomUUID()}`
          : `${KAKAO_OAUTH_EXPO_STATE_PREFIX}.${await Crypto.randomUUID()}`

        const authUrl =
          'https://kauth.kakao.com/oauth/authorize?' +
          new URLSearchParams({
            client_id: kakaoRestApiKey,
            redirect_uri: targetRedirectUri,
            response_type: 'code',
            prompt: 'login',
            through_account: 'true',
            state: oauthState,
          }).toString()

        const startUrl = authUrl
        if (DEBUG_KAKAO_OAUTH) {
          console.log('[KAKAO_OAUTH] before open auth', {
            redirectUri: targetRedirectUri,
            useHttpsBrowserBridge,
            expoReturnUrl,
            authUrl,
            startUrl,
          })
        }
        const result = useHttpsBrowserBridge
          ? await openKakaoOAuthWithBrowserAndLinking(startUrl, expoReturnUrl)
          : await openKakaoOAuthWithAuthSessionAndLinkingFallback(startUrl, targetRedirectUri)
        return { result, oauthState, redirectUri: targetRedirectUri }
      }

      let { result, oauthState, redirectUri: effectiveRedirectUri } = await runAuth(redirectUri)

      if (
        Platform.OS === 'android' &&
        (result.type === 'cancel' || result.type === 'dismiss')
      ) {
        const alternateRedirectUri = getAlternateWwwRedirectUri(redirectUri)
        if (alternateRedirectUri && alternateRedirectUri !== redirectUri) {
          if (DEBUG_KAKAO_OAUTH) {
            console.log('[KAKAO_OAUTH] retry with alternate redirect host', {
              from: redirectUri,
              to: alternateRedirectUri,
              prevResultType: result.type,
            })
          }
          ;({ result, oauthState, redirectUri: effectiveRedirectUri } =
            await runAuth(alternateRedirectUri))
        }
      }

      if (DEBUG_KAKAO_OAUTH) {
        console.log('[KAKAO_OAUTH] auth result', result)
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        if (DEBUG_KAKAO_OAUTH) {
          const initialUrl = await Linking.getInitialURL().catch(() => null)
          const resultUrl =
            'url' in result && typeof result.url === 'string' ? result.url : null
          console.log('[KAKAO_OAUTH] cancel/dismiss debug', {
            resultType: result.type,
            resultUrl,
            initialUrl,
            redirectUri: effectiveRedirectUri,
          })
          Alert.alert(
            'Kakao Debug Cancel',
            `type=${result.type}\nresultUrl=${resultUrl ?? 'null'}\ninitialUrl=${initialUrl ?? 'null'}\nredirectUri=${effectiveRedirectUri}`
          )
        }
        throw new Error('카카오 로그인이 취소되었습니다.')
      }
      if (result.type !== 'success') {
        if (DEBUG_KAKAO_OAUTH) {
          Alert.alert('Kakao Debug', `unexpected result.type=${result.type}`)
        }
        throw new Error('카카오 로그인을 완료할 수 없습니다.')
      }

      const { code, state: returnedState, error, errorDescription } =
        parseKakaoCallbackUrl(result.url)
      if (DEBUG_KAKAO_OAUTH) {
        console.log('[KAKAO_OAUTH] parsed callback', {
          codeLength: code?.length ?? 0,
          returnedState,
          error,
          errorDescription,
          resultUrl: result.url,
        })
      }
      if (error) {
        if (DEBUG_KAKAO_OAUTH) {
          Alert.alert('Kakao Debug Error', `${error}: ${errorDescription ?? ''}`)
        }
        throw new Error(
          errorDescription || error || '카카오 인증에 실패했습니다.'
        )
      }
      if (!code) {
        if (DEBUG_KAKAO_OAUTH) {
          Alert.alert('Kakao Debug', '인가 코드 없음')
        }
        throw new Error(
          '카카오 인가 코드가 없습니다. 카카오 콘솔의 Redirect URI가 앱과 동일한지 확인하세요.'
        )
      }
      if (returnedState !== oauthState) {
        if (DEBUG_KAKAO_OAUTH) {
          Alert.alert('Kakao Debug', 'state mismatch')
        }
        throw new Error(
          '카카오 OAuth state가 일치하지 않습니다. 다시 시도해 주세요.'
        )
      }

      if (DEBUG_KAKAO_OAUTH) {
        console.log('[KAKAO_OAUTH] calling backend loginWithKakao', {
          codeLength: code.length,
          redirectUri: effectiveRedirectUri,
        })
      }
      return loginWithKakao(code, effectiveRedirectUri)
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
          <Text style={styles.title}>바로닥터</Text>
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
            disabled={loginMutation.isPending || kakaoBusy}
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
            disabled={kakaoBusy || loginMutation.isPending}
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

/// <reference types="expo/types" />

/**
 * Metro inlines EXPO_PUBLIC_* at build time. This file types `process.env` for TypeScript only.
 */
declare const process: {
  env: Record<string, string | undefined> & {
    EXPO_PUBLIC_API_URL?: string
    EXPO_PUBLIC_KAKAO_OAUTH_REDIRECT_ORIGIN?: string
    EXPO_PUBLIC_KAKAO_MAP_APP_KEY?: string
    EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?: string
    EXPO_PUBLIC_KAKAO_REST_API_KEY?: string
    EXPO_PUBLIC_KAKAO_MAP_BASE_URL?: string
  }
}

declare module '@react-native-seoul/kakao-login' {
  export type KakaoOAuthToken = {
    accessToken: string
    accessTokenExpiresAt?: string | number
    refreshToken?: string
    refreshTokenExpiresAt?: string | number
    idToken?: string
    tokenType?: string
    scope?: string
    expiresIn?: number
    refreshTokenExpiresIn?: number
  }

  export function login(): Promise<KakaoOAuthToken>
}

export type OAuthProvider = 'google' | 'apple'

/** Deploy-time flag — set when the matching provider is enabled in Supabase Auth. */
export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  const flag =
    provider === 'google'
      ? process.env.NEXT_PUBLIC_OAUTH_GOOGLE
      : process.env.NEXT_PUBLIC_OAUTH_APPLE
  return flag === 'true' || flag === '1'
}

export function enabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = []
  if (isOAuthProviderEnabled('google')) providers.push('google')
  if (isOAuthProviderEnabled('apple')) providers.push('apple')
  return providers
}

export function hasAnyOAuthProvider(): boolean {
  return enabledOAuthProviders().length > 0
}

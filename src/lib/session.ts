export const DEFAULT_SESSION_MAX_AGE = 30 * 24 * 60 * 60
export const SESSION_WITHOUT_REMEMBER_MAX_AGE = 24 * 60 * 60

export function sessionMaxAge(remember: boolean | undefined, configMaxAge: number | undefined): number {
  if (remember !== false) return configMaxAge || DEFAULT_SESSION_MAX_AGE
  return SESSION_WITHOUT_REMEMBER_MAX_AGE
}
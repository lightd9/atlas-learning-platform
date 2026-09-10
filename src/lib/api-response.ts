export function apiErrorMessage(status: number, serverError: unknown, fallback: string) {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have access to this course.'
  if (status === 404) return 'Course not found.'
  return typeof serverError === 'string' && serverError.trim() ? serverError : fallback
}

import { NextResponse } from 'next/server'

export function apiErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error.message === 'COURSE_NOT_FOUND') return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

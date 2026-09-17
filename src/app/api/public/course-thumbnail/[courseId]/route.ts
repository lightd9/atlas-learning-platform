import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { generateThumbnailUrl } from '@/lib/mux'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COURSE_COVER } from '@/lib/course-cover'

const FALLBACK_PATH = path.join(process.cwd(), 'public', DEFAULT_COURSE_COVER)

async function resolveThumbnailUrl(courseId: string): Promise<string | null> {
  const course = await prisma.course.findFirst({
    where: { id: courseId, published: true, status: 'PUBLISHED' },
    select: {
      muxPlaybackId: true,
      modules: {
        orderBy: { sortOrder: 'asc' },
        select: {
          lessons: { where: { muxPlaybackId: { not: null } }, orderBy: { sortOrder: 'asc' }, select: { muxPlaybackId: true } },
        },
      },
    },
  })
  const playbackId = course?.modules.flatMap((module) => module.lessons).find((lesson) => lesson.muxPlaybackId)?.muxPlaybackId ?? course?.muxPlaybackId
  return playbackId ? generateThumbnailUrl(playbackId) : null
}

async function fallbackResponse() {
  return new NextResponse(await readFile(FALLBACK_PATH), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } })
}

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  try {
    const thumbnailUrl = await resolveThumbnailUrl(courseId)
    if (!thumbnailUrl) return await fallbackResponse()
    const response = await fetch(thumbnailUrl, { cache: 'no-store', headers: { 'Accept': 'image/*' } })
    if (!response.ok) return await fallbackResponse()
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86500',
      },
    })
  } catch {
    try { return await fallbackResponse() } catch { return new NextResponse(null, { status: 404 }) }
  }
}
import { NextResponse } from 'next/server'
import { requireAvailableCourse, requireSchoolUser } from '@/lib/access'
import { generateThumbnailUrl } from '@/lib/mux'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireSchoolUser()
    const { courseId } = await params
    if (user.role === 'INSTRUCTOR') {
      const owned = await prisma.course.findFirst({ where: { id: courseId, createdById: user.id }, select: { id: true } })
      if (!owned) return new NextResponse(null, { status: 403 })
    } else if (user.role !== 'ATLAS_ADMIN') {
      await requireAvailableCourse(user, courseId)
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        muxPlaybackId: true,
        modules: { orderBy: { sortOrder: 'asc' }, select: { lessons: { where: { muxPlaybackId: { not: null } }, orderBy: { sortOrder: 'asc' }, select: { muxPlaybackId: true } } } },
      },
    })
    const playbackId = course?.modules.flatMap((module) => module.lessons).find((lesson) => lesson.muxPlaybackId)?.muxPlaybackId ?? course?.muxPlaybackId
    if (!playbackId) return new NextResponse(null, { status: 404 })
    const url = await generateThumbnailUrl(playbackId)
    if (!url) return new NextResponse(null, { status: 503 })
    return NextResponse.redirect(url, { status: 307, headers: { 'Cache-Control': 'private, max-age=3600' } })
  } catch { return new NextResponse(null, { status: 404 }) }
}

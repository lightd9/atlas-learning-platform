import { NextResponse } from 'next/server'
import { requireSchoolUser, requireOwnedCourseEditor, requireAvailableCourse } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'
import { generatePlaybackUrl } from '@/lib/mux'

export async function GET(request: Request, { params }: { params: Promise<{ playbackId: string }> }) {
  try {
    const user = await requireSchoolUser()
    const { playbackId } = await params
    const requestedCourseId = new URL(request.url).searchParams.get('courseId') ?? undefined

    // Find the course that owns this playback ID (course-level or a lesson).
    // Editors must be able to preview drafts, so no publication filter yet.
    const [course, lesson] = await Promise.all([
      prisma.course.findFirst({ where: { muxPlaybackId: playbackId, ...(requestedCourseId ? { id: requestedCourseId } : {}) } }),
      prisma.lesson.findFirst({ where: { muxPlaybackId: playbackId, ...(requestedCourseId ? { module: { courseId: requestedCourseId } } : {}) }, select: { published: true, archived: true, module: { select: { courseId: true, archived: true } } } }),
    ])
    const courseId = course?.id ?? lesson?.module?.courseId
    if (!courseId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const target = course ?? (await prisma.course.findUnique({ where: { id: courseId } }))
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Course editors (Atlas Admin or the owning Instructor) may play back the
    // video even while the course is still a draft.
    if (['ATLAS_ADMIN', 'ATLAS_EMPLOYEE', 'INSTRUCTOR'].includes(user.role)) {
      await requireOwnedCourseEditor(courseId)
    } else {
      await requireAvailableCourse(user, courseId)
      if (!course && lesson && (!lesson.published || lesson.archived || lesson.module.archived)) throw new Error('FORBIDDEN')
    }

    const url = await generatePlaybackUrl(playbackId)
    if (!url) return NextResponse.json({ error: 'Signed playback is not configured' }, { status: 503 })

    return NextResponse.json({ url, courseId: target.id })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load video')
  }
}

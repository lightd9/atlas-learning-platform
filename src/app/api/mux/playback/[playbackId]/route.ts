import { NextResponse } from 'next/server'
import { requireSchoolUser, requireOwnedCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { generatePlaybackUrl } from '@/lib/mux'

export async function GET(request: Request, { params }: { params: Promise<{ playbackId: string }> }) {
  try {
    const user = await requireSchoolUser()
    const { playbackId } = await params

    // Find the course that owns this playback ID (course-level or a lesson).
    // Editors must be able to preview drafts, so no publication filter yet.
    const [course, lesson] = await Promise.all([
      prisma.course.findFirst({ where: { muxPlaybackId: playbackId } }),
      prisma.lesson.findFirst({ where: { muxPlaybackId: playbackId }, select: { module: { select: { courseId: true } } } }),
    ])
    const courseId = course?.id ?? lesson?.module?.courseId
    if (!courseId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const target = course ?? (await prisma.course.findUnique({ where: { id: courseId } }))
    if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Course editors (Atlas Admin or the owning Instructor) may play back the
    // video even while the course is still a draft.
    let editorAccess = false
    if (user.role === 'ATLAS_ADMIN' || user.role === 'INSTRUCTOR') {
      try { await requireOwnedCourseEditor(courseId); editorAccess = true } catch {}
    }

    if (!editorAccess) {
      if (!target.published) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (user.schoolId) {
        const access = await prisma.schoolCourse.findUnique({
          where: { schoolId_courseId: { schoolId: user.schoolId, courseId: target.id } },
        })
        if (access && !access.enabled) return NextResponse.json({ error: 'Course not available' }, { status: 403 })
      }
    }

    const url = await generatePlaybackUrl(playbackId)
    if (!url) return NextResponse.json({ error: 'Signed playback is not configured' }, { status: 503 })

    return NextResponse.json({ url, courseId: target.id })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
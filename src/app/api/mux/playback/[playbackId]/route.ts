import { NextResponse } from 'next/server'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { generatePlaybackUrl } from '@/lib/mux'

export async function GET(request: Request, { params }: { params: Promise<{ playbackId: string }> }) {
  try {
    const user = await requireSchoolUser()
    const { playbackId } = await params

    // Find course with this playback ID to verify access
    const [course, lesson] = await Promise.all([
      prisma.course.findFirst({ where: { muxPlaybackId: playbackId, published: true } }),
      prisma.lesson.findFirst({ where: { muxPlaybackId: playbackId, published: true }, include: { module: { select: { courseId: true, course: { select: { published: true } } } } } }),
    ])
    const courseId = course?.id ?? (lesson?.module.course.published ? lesson.module.courseId : null)
    const playableCourse = course ?? (courseId ? await prisma.course.findUnique({ where: { id: courseId } }) : null)

    if (!playableCourse) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Find the course with this playback ID (or its lesson playback ID) to verify access.
    const accessCourse = playableCourse

    // Check school access
    if (user.schoolId) {
      const access = await prisma.schoolCourse.findUnique({
        where: { schoolId_courseId: { schoolId: user.schoolId, courseId: accessCourse.id } },
      })
      if (access && !access.enabled) return NextResponse.json({ error: 'Course not available' }, { status: 403 })
    }

    const url = await generatePlaybackUrl(playbackId)
    if (!url) return NextResponse.json({ error: 'Signed playback is not configured' }, { status: 503 })

    return NextResponse.json({ url, courseId: accessCourse.id })
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

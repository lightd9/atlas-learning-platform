import { NextResponse } from 'next/server'
import { requireSchoolManager, requireSchoolVisibleCourse } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'

// Read-only preview of a parent-audience course for a school manager
// (headteacher or Atlas Admin). No learner progress is ever recorded here.
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { courseId } = await params

    const available = await requireSchoolVisibleCourse(manager, courseId)
    if (available.audience !== 'PARENT') throw new Error('COURSE_NOT_FOUND')

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
        notes: true,
        durationMinutes: true,
        durationSeconds: true,
        muxPlaybackId: true,
        section: { select: { id: true, name: true, slug: true, description: true, sortOrder: true } },
        modules: {
          where: { lessons: { some: { published: true } } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            sortOrder: true,
            lessons: {
              where: { published: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, title: true, description: true, durationSeconds: true, muxPlaybackId: true, sortOrder: true },
            },
          },
        },
      },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    let resources: unknown[] = []
    try {
      resources = await prisma.courseResource.findMany({ where: { courseId }, orderBy: { sortOrder: 'asc' } })
    } catch (resourceError) {
      console.warn('Unable to load optional course resources', resourceError)
    }

    return NextResponse.json({ course: { ...course, resources } })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load course')
  }
}

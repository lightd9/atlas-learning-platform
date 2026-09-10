import { NextResponse } from 'next/server'
import { requireAvailableCourse, requireSchoolUser } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSchoolUser()
    const { id } = await params
    await requireAvailableCourse(user, id)

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        progress: { where: { userId: user.id } },
        section: { select: { id: true, name: true, slug: true, description: true, sortOrder: true } },
        modules: {
          where: { lessons: { some: { published: true } } },
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              where: { published: true },
              orderBy: { sortOrder: 'asc' },
              include: { progress: { where: { userId: user.id } } },
            },
          },
        },
      },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    let resources: unknown[] = []
    try {
      resources = await prisma.courseResource.findMany({ where: { courseId: id }, orderBy: { sortOrder: 'asc' } })
    } catch (resourceError) {
      console.warn('Unable to load optional course resources', resourceError)
    }

    return NextResponse.json({ course: { ...course, resources } })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load course')
  }
}

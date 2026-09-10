import { NextResponse } from 'next/server'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-errors'

export async function GET() {
  try {
    const user = await requireSchoolUser()

    const courses = await prisma.course.findMany({
      where: {
        published: true,
        OR: [
          { schoolAccess: { none: { schoolId: user.schoolId ?? undefined } } },
          { schoolAccess: { some: { schoolId: user.schoolId ?? undefined, enabled: true } } },
        ],
      },
      include: {
        progress: { where: { userId: user.id } },
        section: { select: { id: true, name: true, slug: true, description: true, sortOrder: true } },
        modules: {
          where: { lessons: { some: { published: true } } },
          orderBy: { sortOrder: 'asc' },
          include: { lessons: { where: { published: true }, orderBy: { sortOrder: 'asc' }, include: { progress: { where: { userId: user.id } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Resources are optional course metadata. Load them independently so a
    // course with no resources (or a temporarily unavailable optional table)
    // never prevents teachers and headteachers from seeing their courses.
    let resourcesByCourse = new Map<string, unknown[]>()
    try {
      const resources = await prisma.courseResource.findMany({
        where: { courseId: { in: courses.map((course) => course.id) } },
        orderBy: { sortOrder: 'asc' },
      })
      resourcesByCourse = resources.reduce((map, resource) => {
        const existing = map.get(resource.courseId) ?? []
        existing.push(resource)
        map.set(resource.courseId, existing)
        return map
      }, new Map<string, unknown[]>())
    } catch (resourceError) {
      console.warn('Unable to load optional course resources', resourceError)
    }

    const payload = { courses: courses.map((course) => ({ ...course, resources: resourcesByCourse.get(course.id) ?? [] })) }
    return NextResponse.json(payload)
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load courses')
  }
}

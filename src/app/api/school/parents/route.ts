import { NextResponse } from 'next/server'
import { requireSchoolManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const manager = await requireSchoolManager()
    const schoolId = manager.schoolId ?? new URL(request.url).searchParams.get('schoolId')
    if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })

    const [school, parents, courseAccess, parentCourses] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, parentRegistrationToken: true, parentRegistrationEnabled: true } }),
      prisma.user.findMany({ where: { schoolId, role: 'PARENT' }, select: { id: true, name: true, email: true, status: true, lastActiveAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.schoolCourse.findMany({ where: { schoolId }, select: { courseId: true, enabled: true } }),
      prisma.course.findMany({ where: { audience: 'PARENT', published: true }, select: { id: true, title: true, durationMinutes: true, description: true }, orderBy: { createdAt: 'desc' } }),
    ])
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    const accessByCourse = new Map(courseAccess.map((access) => [access.courseId, access.enabled]))
    const courses = parentCourses.filter((course) => accessByCourse.get(course.id) ?? true)

    return NextResponse.json({
      schoolName: school.name,
      link: { token: school.parentRegistrationToken, enabled: school.parentRegistrationEnabled },
      parents: parents.map((parent) => ({ id: parent.id, name: parent.name, email: parent.email, status: parent.status, lastActiveAt: parent.lastActiveAt?.toISOString() ?? null, createdAt: parent.createdAt.toISOString() })),
      courses,
    })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load parents'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

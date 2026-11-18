import { NextResponse } from 'next/server'
import { requireHeadteacher } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { buildLearnerCourseWhere } from '@/lib/course-access-policy'
import { apiErrorResponse } from '@/lib/api-errors'

export async function GET() {
  try {
    const manager = await requireHeadteacher()
    if (!manager.schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })
    const [courses, progress] = await Promise.all([
      prisma.course.findMany({ where: buildLearnerCourseWhere(manager), select: { id: true, title: true, durationMinutes: true } }),
      prisma.courseProgress.findMany({ where: { user: { schoolId: manager.schoolId, role: { in: ['TEACHER', 'HEADTEACHER'] } } }, select: { courseId: true, status: true, percentComplete: true, watchedSeconds: true } }),
    ])
    return NextResponse.json({ courses: courses.map((course) => { const rows = progress.filter((item) => item.courseId === course.id); return { ...course, learnerCount: rows.length, completionCount: rows.filter((item) => item.status === 'COMPLETED').length, averageProgress: rows.length ? Math.round(rows.reduce((sum, item) => sum + Number(item.percentComplete), 0) / rows.length) : 0, totalWatchedSeconds: rows.reduce((sum, item) => sum + item.watchedSeconds, 0) } }) })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load course analytics')
  }
}

import { NextResponse } from 'next/server'
import { requireHeadteacher } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const manager = await requireHeadteacher()
    if (!manager.schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })
    const [courses, progress] = await Promise.all([
      prisma.course.findMany({ where: { published: true, OR: [{ schoolAccess: { none: { schoolId: manager.schoolId } } }, { schoolAccess: { some: { schoolId: manager.schoolId, enabled: true } } }] }, select: { id: true, title: true, durationMinutes: true } }),
      prisma.courseProgress.findMany({ where: { user: { schoolId: manager.schoolId } }, select: { courseId: true, status: true, percentComplete: true, watchedSeconds: true } }),
    ])
    return NextResponse.json({ courses: courses.map((course) => { const rows = progress.filter((item) => item.courseId === course.id); return { ...course, learnerCount: rows.length, completionCount: rows.filter((item) => item.status === 'COMPLETED').length, averageProgress: rows.length ? Math.round(rows.reduce((sum, item) => sum + Number(item.percentComplete), 0) / rows.length) : 0, totalWatchedSeconds: rows.reduce((sum, item) => sum + item.watchedSeconds, 0) } }) })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load course analytics'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

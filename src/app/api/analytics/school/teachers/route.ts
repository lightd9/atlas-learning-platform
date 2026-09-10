import { NextResponse } from 'next/server'
import { requireHeadteacher } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const manager = await requireHeadteacher()
    if (!manager.schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })
    const teachers = await prisma.user.findMany({ where: { schoolId: manager.schoolId, role: 'TEACHER' }, include: { progress: { include: { course: { select: { id: true, title: true } } } } }, orderBy: { name: 'asc' } })
    return NextResponse.json({ teachers: teachers.map((teacher) => ({ id: teacher.id, name: teacher.name, email: teacher.email, status: teacher.status, lastActiveAt: teacher.lastActiveAt, progress: teacher.progress.map((item) => ({ courseId: item.courseId, courseTitle: item.course.title, percentComplete: Number(item.percentComplete), status: item.status, watchedSeconds: item.watchedSeconds, lastWatchedAt: item.lastWatchedAt })) })) })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load teacher analytics'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

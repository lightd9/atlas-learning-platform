import { NextResponse } from 'next/server'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']

export async function GET() {
  try {
    await requireAtlasAdmin()

    const [schools, allSchools, courses, publishedCourses, allProgress, invitations, recentCourses, incompleteCourses] = await Promise.all([
      prisma.school.findMany({
        where: { active: true },
        include: {
          _count: { select: { users: true } },
          users: {
            where: { role: 'TEACHER' },
            select: { progress: { select: { percentComplete: true, status: true } } },
          },
        },
      }),
      prisma.school.count(),
      prisma.course.count(),
      prisma.course.count({ where: { published: true } }),
      prisma.courseProgress.findMany({ select: { percentComplete: true, status: true, watchedSeconds: true } }),
      prisma.invitation.count({ where: { status: 'PENDING' } }),
      prisma.course.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { section: { select: { name: true } }, _count: { select: { modules: true } } } }),
      prisma.course.findMany({ where: { OR: [{ modules: { none: {} } }, { modules: { some: { lessons: { none: {} } } } }] }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true } }),
    ])

    const totalTeachers = schools.reduce((sum, s) => sum + s._count.users, 0)
    const totalCompletions = allProgress.filter((p) => p.status === 'COMPLETED').length
    const totalMinutes = Math.round(allProgress.reduce((sum, p) => sum + p.watchedSeconds, 0) / 60)
    const totalHeadteachers = await prisma.user.count({ where: { role: 'HEADTEACHER' } })

    const schoolBreakdown = schools.map((s, i) => {
      const schoolProgress = s.users.flatMap((u) => u.progress)
      const avg = schoolProgress.length > 0
        ? Math.round(schoolProgress.reduce((a, p) => a + Number(p.percentComplete), 0) / schoolProgress.length)
        : 0
      return {
        schoolName: s.name,
        teacherCount: s._count.users,
        completionCount: schoolProgress.filter((p) => p.status === 'COMPLETED').length,
        avgProgress: avg,
        tone: tones[i % tones.length],
      }
    })

    const payload = {
      totalSchools: allSchools,
      activeSchools: schools.length,
      totalTeachers,
      totalHeadteachers,
      totalCourses: courses,
      totalCompletions,
      totalLearningMinutes: totalMinutes,
      activeInvitations: invitations,
      publishedCourses,
      draftCourses: courses - publishedCourses,
      recentCourses,
      incompleteCourses,
      schoolBreakdown,
    }
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load analytics'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

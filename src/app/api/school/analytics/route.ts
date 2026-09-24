import { NextResponse } from 'next/server'
import { requireAtlasAdmin, requireHeadteacher } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']

export async function GET(request: Request) {
  try {
    const requestedSchoolId = new URL(request.url).searchParams.get('schoolId')
    let schoolId: string | null = null
    if (requestedSchoolId) {
      await requireAtlasAdmin()
      schoolId = requestedSchoolId
    } else {
      const manager = await requireHeadteacher()
      schoolId = manager.schoolId
    }
    if (!schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })

    const [users, courses, allProgress] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId },
        include: { progress: { select: { percentComplete: true, status: true, lastWatchedAt: true } } },
      }),
      prisma.course.findMany({
        where: { published: true },
        select: { id: true, title: true },
      }),
      prisma.courseProgress.findMany({
        where: { user: { schoolId } },
        select: { userId: true, courseId: true, percentComplete: true, status: true, watchedSeconds: true, lastWatchedAt: true },
      }),
    ])

    const activeTeachers = users.filter((u) => u.status === 'ACTIVE').length
    const pendingTeachers = users.filter((u) => u.status === 'INVITED').length

    const coursesCompleted = allProgress.filter((p) => p.status === 'COMPLETED').length

    const totalMinutes = Math.round(allProgress.reduce((sum, p) => sum + p.watchedSeconds, 0) / 60)

    const allProgressValues = allProgress.map((p) => Number(p.percentComplete))
    const averageProgress = allProgressValues.length > 0
      ? Math.round(allProgressValues.reduce((a, b) => a + b, 0) / allProgressValues.length)
      : 0

    const teacherActivity = users
      .filter((u) => u.role !== 'ATLAS_ADMIN')
      .map((u) => {
        const progressValues = u.progress.map((p) => Number(p.percentComplete))
        const avg = progressValues.length > 0
          ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
          : 0

        const isActive = u.status === 'ACTIVE'
        const lastActiveMs = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0
        const lastWatchMs = u.progress.reduce((max, p) => {
          if (!p.lastWatchedAt) return max
          return Math.max(max, new Date(p.lastWatchedAt).getTime())
        }, 0)
        const mostRecentMs = Math.max(lastActiveMs, lastWatchMs)

        let statusLabel = 'Pending'
        let lastActiveLabel = '—'
        if (isActive) {
          statusLabel = 'Active'
          if (mostRecentMs > 0) {
            const diffMs = Date.now() - mostRecentMs
            const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
            if (days <= 0) lastActiveLabel = 'Today'
            else if (days === 1) lastActiveLabel = 'Yesterday'
            else if (days < 7) lastActiveLabel = `${days} days ago`
            else lastActiveLabel = new Date(mostRecentMs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          }
        }

        const initials = u.name.split(' ').map((n) => n[0]).join('')
        return {
          name: u.name,
          progress: `${avg}%`,
          status: statusLabel,
          lastActive: lastActiveLabel,
          initials,
        }
      })
      .sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1
        if (a.status !== 'Active' && b.status === 'Active') return 1
        return 0
      })

    // Keep the breakdown tied to the actual course progress values. The old
    // implementation treated the sum of percentages as a pie-chart share,
    // which made the chart difficult to interpret and excluded untouched
    // courses entirely.
    const courseBreakdown = courses
      .map((course, i) => {
        const rows = allProgress.filter((p) => p.courseId === course.id)
        const average = rows.length
          ? Math.round(rows.reduce((sum, row) => sum + Number(row.percentComplete), 0) / rows.length)
          : 0
        const completed = rows.filter((row) => row.status === 'COMPLETED').length
        return {
          title: course.title,
          percent: average,
          completed,
          learners: rows.length,
          tone: tones[i % tones.length],
        }
      })
      .sort((a, b) => b.percent - a.percent)

    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (29 - i))
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
    const activity = days.map(() => 0)
    for (const p of allProgress) {
      if (!p.lastWatchedAt) continue
      const time = new Date(p.lastWatchedAt).getTime()
      const index = days.findIndex((d) => time >= d && time < d + 86400000)
      if (index >= 0) activity[index] += p.watchedSeconds / 60
    }
    const learningActivity = days.map((d, i) => ({
      label: new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      minutes: Math.round(activity[i]),
    }))

    const payload = {
      activeTeachers,
      totalTeachers: users.length,
      pendingTeachers,
      coursesCompleted,
      totalLearningMinutes: totalMinutes,
      averageProgress,
      teacherActivity,
      courseBreakdown,
      learningActivity,
    }
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load analytics'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

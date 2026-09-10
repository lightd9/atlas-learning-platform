import { NextResponse } from 'next/server'
import { requireHeadteacher } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const tones = ['blue', 'mint', 'lilac', 'peach', 'violet']

export async function GET() {
  try {
    const manager = await requireHeadteacher()
    if (!manager.schoolId) return NextResponse.json({ error: 'No school' }, { status: 400 })

    const schoolId = manager.schoolId

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
        const hasProgress = u.progress.some((p) => p.status === 'IN_PROGRESS' || p.status === 'COMPLETED')
        const lastActive = u.lastActiveAt
        const recentActivity = u.progress.some((p) => {
          if (!p.lastWatchedAt) return false
          const diff = Date.now() - new Date(p.lastWatchedAt).getTime()
          return diff < 24 * 60 * 60 * 1000
        })

        let statusLabel = 'Pending'
        let lastActiveLabel = '—'
        if (isActive && hasProgress) {
          statusLabel = 'Active'
          if (recentActivity) lastActiveLabel = 'Today'
          else if (lastActive) {
            const diff = Date.now() - new Date(lastActive).getTime()
            const days = Math.floor(diff / (24 * 60 * 60 * 1000))
            if (days <= 1) lastActiveLabel = 'Yesterday'
            else if (days < 7) lastActiveLabel = `${days} days ago`
            else lastActiveLabel = new Date(lastActive).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          }
        } else if (isActive) {
          statusLabel = 'Active'
          lastActiveLabel = lastActive ? new Date(lastActive).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'
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

    const progressCounts: Record<string, number> = {}
    for (const p of allProgress) {
      const courseTitle = courses.find((c) => c.id === p.courseId)?.title ?? 'Unknown'
      progressCounts[courseTitle] = (progressCounts[courseTitle] || 0) + Number(p.percentComplete)
    }
    const courseCountMap: Record<string, number> = {}
    for (const p of allProgress) {
      const courseTitle = courses.find((c) => c.id === p.courseId)?.title ?? 'Unknown'
      courseCountMap[courseTitle] = (courseCountMap[courseTitle] || 0) + 1
    }

    const totalProgress = Object.values(progressCounts).reduce((a, b) => a + b, 0) || 1
    const courseBreakdown = Object.entries(progressCounts)
      .map(([title, sum], i) => ({
        title,
        percent: Math.round((sum / totalProgress) * 100),
        tone: tones[i % tones.length],
      }))
      .sort((a, b) => b.percent - a.percent)

    if (courseBreakdown.length < 3) {
      const usedTitles = new Set(courseBreakdown.map((c) => c.title))
      for (const course of courses) {
        if (courseBreakdown.length >= 3) break
        if (!usedTitles.has(course.title)) {
          courseBreakdown.push({ title: course.title, percent: 0, tone: tones[courseBreakdown.length % tones.length] })
        }
      }
    }

    const notStartedCount = allProgress.filter((p) => p.status === 'NOT_STARTED').length
    const totalEnrollments = allProgress.length || 1
    if (courseBreakdown.length >= 3) {
      const notStartedPercent = Math.round((notStartedCount / totalEnrollments) * 100)
      if (notStartedPercent > 0) {
        courseBreakdown.push({ title: 'Not started', percent: notStartedPercent, tone: 'gray' })
      }
    }

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

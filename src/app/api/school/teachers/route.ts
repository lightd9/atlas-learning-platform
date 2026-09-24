import { NextResponse } from 'next/server'
import { requireSchoolManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const manager = await requireSchoolManager()
    if (!manager.schoolId) return NextResponse.json({ teachers: [] })

    const users = await prisma.user.findMany({
      where: { schoolId: manager.schoolId },
      include: {
        progress: {
          select: { percentComplete: true, lastWatchedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const teachers = users.map((u) => {
      const progressValues = u.progress.map((p) => Number(p.percentComplete))
      const avg = progressValues.length > 0
        ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
        : 0

      const lastActiveMs = u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0
      const lastWatchMs = u.progress.reduce((max, p) => {
        if (!p.lastWatchedAt) return max
        return Math.max(max, new Date(p.lastWatchedAt).getTime())
      }, 0)
      const mostRecentMs = Math.max(lastActiveMs, lastWatchMs)

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastActiveAt: mostRecentMs > 0 ? new Date(mostRecentMs).toISOString() : null,
        averageProgress: avg,
      }
    })

    return NextResponse.json({ teachers })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load teachers'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

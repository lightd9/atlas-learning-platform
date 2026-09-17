import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const placements = await prisma.homePagePlacement.findMany({
    where: { active: true, course: { published: true, status: 'PUBLISHED' } },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    include: { course: { select: { id: true, slug: true, title: true, description: true, coverImageUrl: true, durationMinutes: true, muxPlaybackId: true, section: { select: { name: true } } } } },
  })
  const grouped = { RECOMMENDED: [], TOP_COURSES: [], UNLOCK_SOMETHING_NEW: [], EXPLORE: [] } as Record<string, unknown[]>
  for (const placement of placements) grouped[placement.section].push({ ...placement.course, placementId: placement.id, sortOrder: placement.sortOrder })
  return NextResponse.json(grouped, { headers: { 'Cache-Control': 'no-store' } })
}

import { NextResponse } from 'next/server'
import { serializeHomeContent } from '@/lib/home-content'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const placements = await prisma.homePagePlacement.findMany({
    where: { active: true, course: { published: true, status: 'PUBLISHED' } },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    include: { course: { select: { id: true, slug: true, title: true, description: true, coverImageUrl: true, durationMinutes: true, muxPlaybackId: true, section: { select: { name: true } }, published: true, status: true, audience: true } } },
  })
  const grouped = serializeHomeContent(placements as never)
  return NextResponse.json(grouped, { headers: { 'Cache-Control': 'no-store' } })
}

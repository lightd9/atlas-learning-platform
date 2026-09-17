import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireHomeContentManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const sectionSchema = z.enum(['RECOMMENDED', 'TOP_COURSES', 'UNLOCK_SOMETHING_NEW', 'EXPLORE'])
const placementSchema = z.object({ courseId: z.string().min(1), section: sectionSchema, sortOrder: z.number().int().nonnegative().optional(), active: z.boolean().optional() })
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) })
const sectionLimits: Record<string, number | null> = { RECOMMENDED: 5, TOP_COURSES: null, UNLOCK_SOMETHING_NEW: 6, EXPLORE: null }

export async function GET() {
  try {
    await requireHomeContentManager()
    const placements = await prisma.homePagePlacement.findMany({ orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }], include: { course: { select: { id: true, title: true, published: true, status: true, coverImageUrl: true } } } })
    return NextResponse.json({ placements })
  } catch { return NextResponse.json({ error: 'Unable to load home page content' }, { status: 403 }) }
}

export async function POST(request: Request) {
  try {
    await requireHomeContentManager()
    const parsed = placementSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Select a valid course and homepage section.' }, { status: 400 })
    const { courseId, section, sortOrder = 0, active = true } = parsed.data
    const limit = sectionLimits[section]
    if (limit !== null) {
      const count = await prisma.homePagePlacement.count({ where: { section, active: true } })
      const alreadyPlaced = await prisma.homePagePlacement.findUnique({ where: { courseId_section: { courseId, section } }, select: { id: true } })
      if (!alreadyPlaced && count >= limit) return NextResponse.json({ error: `${section === 'RECOMMENDED' ? 'Recommended for you' : 'Unlock something new'} can contain a maximum of ${limit} courses.` }, { status: 400 })
    }
    const course = await prisma.course.findFirst({ where: { id: courseId, published: true, status: 'PUBLISHED' }, select: { id: true } })
    if (!course) return NextResponse.json({ error: 'Only published courses can be placed on the public site.' }, { status: 400 })
    const placement = await prisma.homePagePlacement.upsert({ where: { courseId_section: { courseId, section } }, update: { sortOrder, active }, create: { courseId, section, sortOrder, active } })
    return NextResponse.json({ placement }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Unable to save homepage placement' }, { status: 403 }) }
}

export async function DELETE(request: Request) {
  try {
    await requireHomeContentManager()
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Placement id is required.' }, { status: 400 })
    await prisma.homePagePlacement.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Unable to remove homepage placement' }, { status: 403 }) }
}

export async function PATCH(request: Request) {
  try {
    await requireHomeContentManager()
    const parsed = reorderSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'A valid placement order is required.' }, { status: 400 })
    await prisma.$transaction(parsed.data.ids.map((id, index) => prisma.homePagePlacement.update({ where: { id }, data: { sortOrder: index } })))
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Unable to reorder homepage content' }, { status: 403 }) }
}

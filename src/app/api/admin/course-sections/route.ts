import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  sortOrder: z.number().int().min(0).default(0),
})

export async function GET() {
  try {
    await requireAtlasAdmin()
    const sections = await prisma.courseSection.findMany({
      include: { _count: { select: { courses: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ sections })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load sections'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(request: Request) {
  try {
    await requireAtlasAdmin()
    const body = sectionSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Enter a valid section name and slug.' }, { status: 400 })
    const section = await prisma.courseSection.create({ data: body.data })
    return NextResponse.json({ section }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create section'
    const status = message === 'Unauthorized' ? 401 : error instanceof Error && 'code' in error && error.code === 'P2002' ? 409 : 403
    return NextResponse.json({ error: status === 409 ? 'That section slug already exists.' : message }, { status })
  }
}

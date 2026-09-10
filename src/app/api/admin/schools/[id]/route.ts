import { NextResponse } from 'next/server'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  active: z.boolean().optional(),
  headteacherId: z.string().nullable().optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAtlasAdmin()
    const { id } = await params
    const [school, totalPublishedCourses] = await Promise.all([prisma.school.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, courseAccess: true } },
        users: {
          select: { id: true, name: true, email: true, role: true, status: true, lastActiveAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        invitations: {
          where: { status: { in: ['PENDING', 'EXPIRED'] } },
          select: { id: true, name: true, email: true, status: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        courseAccess: {
          include: { course: { select: { id: true, title: true, published: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    }), prisma.course.count({ where: { published: true } })])
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })
    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        active: school.active,
        userCount: school._count.users,
        courseCount: Math.max(0, totalPublishedCourses - school.courseAccess.filter((access) => !access.enabled).length),
        createdAt: school.createdAt.toISOString(),
        users: school.users,
        invitations: school.invitations,
        courseAccess: school.courseAccess,
      },
    })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load school'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAtlasAdmin()
    const { id } = await params
    const body = updateSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    const existingSchool = await prisma.school.findUnique({ where: { id } })
    if (!existingSchool) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    const { headteacherId, ...schoolData } = body.data
    if (headteacherId !== undefined) {
      if (headteacherId) {
        const candidate = await prisma.user.findUnique({ where: { id: headteacherId }, select: { id: true, schoolId: true, role: true, status: true } })
        if (!candidate || candidate.schoolId !== id || !['TEACHER', 'HEADTEACHER'].includes(candidate.role) || candidate.status === 'DISABLED') {
          return NextResponse.json({ error: 'Select an active teacher from this school.' }, { status: 400 })
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { schoolId: id, role: 'HEADTEACHER', ...(headteacherId ? { id: { not: headteacherId } } : {}) },
          data: { role: 'TEACHER' },
        })
        if (headteacherId) await tx.user.update({ where: { id: headteacherId }, data: { role: 'HEADTEACHER', schoolId: id } })
        await tx.school.update({ where: { id }, data: schoolData })
      })
    } else {
      await prisma.school.update({ where: { id }, data: schoolData })
    }
    const school = await prisma.school.findUniqueOrThrow({ where: { id } })
    return NextResponse.json({ school: { id: school.id, name: school.name, slug: school.slug, active: school.active } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update school'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

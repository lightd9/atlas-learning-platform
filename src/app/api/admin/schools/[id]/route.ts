import { NextResponse } from 'next/server'
import { requireAtlasAdmin, requirePermission } from '@/lib/access'
import { auditLog } from '@/lib/audit'
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
    await requirePermission('SCHOOL_CREATE')
    const { id } = await params
    const [school, totalPublishedCourses, parentCount] = await Promise.all([prisma.school.findUnique({
      where: { id },
      include: {
        _count: { select: { courseAccess: true } },
        users: {
          where: { role: { not: 'PARENT' } },
          select: { id: true, name: true, email: true, role: true, status: true, lastActiveAt: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        invitations: {
          where: { status: { in: ['PENDING', 'EXPIRED'] } },
          select: { id: true, name: true, email: true, status: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        courseAccess: {
          include: { course: { select: { id: true, title: true, published: true, audience: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    }), prisma.course.count({ where: { published: true } }), prisma.user.count({ where: { schoolId: id, role: 'PARENT' } })])
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })
    return NextResponse.json({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
        active: school.active,
        userCount: school.users.length,
        parentCount,
        courseCount: Math.max(0, totalPublishedCourses - school.courseAccess.filter((access) => !access.enabled).length),
        parentRegistration: { enabled: school.parentRegistrationEnabled, token: school.parentRegistrationToken },
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAtlasAdmin()
    const { id } = await params

    const school = await prisma.school.findUnique({ where: { id }, select: { id: true, name: true, slug: true } })
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    // School-bound members (headteachers, teachers, parents) and anything they
    // own are removed with the school. Atlas-level accounts are never touched.
    const members = await prisma.user.findMany({
      where: { schoolId: id, role: { in: ['HEADTEACHER', 'TEACHER', 'PARENT'] } },
      select: { id: true },
    })
    const memberIds = members.map((member) => member.id)

    const invitationWhere = {
      OR: [
        { schoolId: id },
        ...(memberIds.length ? [{ invitedById: { in: memberIds } }] : []),
      ],
    }

    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: invitationWhere }),
      prisma.user.deleteMany({ where: { id: { in: memberIds } } }),
      prisma.school.delete({ where: { id } }),
    ])

    await auditLog({
      action: 'SCHOOL.DELETE',
      userId: admin.id,
      details: `Deleted school ${school.name} (${school.slug})${memberIds.length ? ` with ${memberIds.length} member(s)` : ''}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to delete school'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

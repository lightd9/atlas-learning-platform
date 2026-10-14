import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAtlasAdmin, requirePermission } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'
import { createParentRegistrationToken } from '@/lib/parent-registration'

const linkSchema = z.object({
  enabled: z.boolean().optional(),
})

async function loadParents(schoolId: string) {
  const [school, parents, courseAccess, parentCourses] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, parentRegistrationToken: true, parentRegistrationEnabled: true, parentRegistrationTokenCreatedAt: true } }),
    prisma.user.findMany({ where: { schoolId, role: 'PARENT' }, select: { id: true, name: true, email: true, status: true, lastActiveAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
    prisma.schoolCourse.findMany({ where: { schoolId }, select: { courseId: true, enabled: true } }),
    prisma.course.findMany({ where: { audience: 'PARENT' }, select: { id: true, title: true, published: true }, orderBy: { createdAt: 'desc' } }),
  ])
  if (!school) return null
  const accessByCourse = new Map(courseAccess.map((access) => [access.courseId, access.enabled]))
  return {
    link: {
      token: school.parentRegistrationToken,
      enabled: school.parentRegistrationEnabled,
      createdAt: school.parentRegistrationTokenCreatedAt?.toISOString() ?? null,
    },
    parents: parents.map((parent) => ({ id: parent.id, name: parent.name, email: parent.email, status: parent.status, lastActiveAt: parent.lastActiveAt?.toISOString() ?? null, createdAt: parent.createdAt.toISOString() })),
    courses: parentCourses.map((course) => ({ id: course.id, title: course.title, published: course.published, enabled: accessByCourse.get(course.id) ?? true })),
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('SCHOOL_CREATE')
    const { id } = await params
    const data = await loadParents(id)
    if (!data) return NextResponse.json({ error: 'School not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load parents'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAtlasAdmin()
    const { id } = await params
    const school = await prisma.school.findUnique({ where: { id }, select: { id: true, name: true, parentRegistrationToken: true } })
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    const token = createParentRegistrationToken()
    await prisma.school.update({ where: { id }, data: { parentRegistrationToken: token, parentRegistrationEnabled: true, parentRegistrationTokenCreatedAt: new Date() } })
    await auditLog({ action: school.parentRegistrationToken ? 'SCHOOL.PARENT_LINK_REGENERATE' : 'SCHOOL.PARENT_LINK_GENERATE', userId: admin.id, schoolId: id, details: `Parent registration link ${school.parentRegistrationToken ? 'regenerated' : 'generated'} for ${school.name}` })

    return NextResponse.json({ token, enabled: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update parent registration link'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAtlasAdmin()
    const { id } = await params
    const body = linkSchema.safeParse(await request.json())
    if (!body.success || body.data.enabled === undefined) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    const school = await prisma.school.findUnique({ where: { id }, select: { id: true, name: true, parentRegistrationToken: true } })
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

    const token = body.data.enabled && !school.parentRegistrationToken ? createParentRegistrationToken() : school.parentRegistrationToken
    await prisma.school.update({
      where: { id },
      data: {
        parentRegistrationEnabled: body.data.enabled,
        ...(body.data.enabled && !school.parentRegistrationToken ? { parentRegistrationToken: token, parentRegistrationTokenCreatedAt: new Date() } : {}),
      },
    })
    await auditLog({ action: body.data.enabled ? 'SCHOOL.PARENT_LINK_ENABLE' : 'SCHOOL.PARENT_LINK_DISABLE', userId: admin.id, schoolId: id, details: `Parent registration ${body.data.enabled ? 'enabled' : 'disabled'} for ${school.name}` })

    return NextResponse.json({ token, enabled: body.data.enabled })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update parent registration link'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

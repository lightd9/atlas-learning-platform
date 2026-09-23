import { NextResponse } from 'next/server'
import { requirePermission, requireSchoolDirectoryAccess } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { createInvitationToken, invitationExpiry } from '@/lib/invitations'
import { headteacherSetupEmail, sendEmail } from '@/lib/email'
import { auditLog } from '@/lib/audit'

export async function GET() {
  try {
    await requireSchoolDirectoryAccess()
    const [schools, totalPublishedCourses] = await Promise.all([prisma.school.findMany({
      include: {
        _count: { select: { users: true } },
        courseAccess: { select: { enabled: true } },
      },
      orderBy: { createdAt: 'desc' },
    }), prisma.course.count({ where: { published: true } })])
    const data = schools.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      active: s.active,
      userCount: s._count.users,
      courseCount: Math.max(0, totalPublishedCourses - s.courseAccess.filter((access) => !access.enabled).length),
      createdAt: s.createdAt.toISOString(),
    }))
    return NextResponse.json({ schools: data })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load schools'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePermission('SCHOOL_CREATE')
    const body = await request.json()
    const { name, slug, headteacherEmail, headteacherName } = body
    if (!name || !slug) return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })

    const existing = await prisma.school.findUnique({ where: { slug } })
    if (existing) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const school = await prisma.school.create({ data: { name, slug } })

    let setupUrl: string | null = null
    let invitationId: string | null = null
    let invitationExpiresAt: Date | null = null
    if (headteacherEmail && headteacherName) {
      const { rawToken, tokenHash } = createInvitationToken()
      const expiresAt = invitationExpiry()
      const invitation = await prisma.invitation.create({ data: { email: headteacherEmail.toLowerCase(), name: headteacherName, role: 'HEADTEACHER', schoolId: school.id, invitedById: admin.id, tokenHash, expiresAt } })
      invitationId = invitation.id
      invitationExpiresAt = invitation.expiresAt
      setupUrl = `/setup/${rawToken}`
      const email = headteacherSetupEmail(headteacherName, school.name, rawToken)
      await sendEmail({ to: headteacherEmail.toLowerCase(), ...email })
      await auditLog({ action: 'INVITATION.CREATE', userId: admin.id, schoolId: school.id, details: `Headteacher invitation created for ${headteacherEmail.toLowerCase()}` })
    }

    return NextResponse.json({ school: { id: school.id, name: school.name, slug: school.slug, active: school.active }, setupUrl, invitationId, expiresAt: invitationExpiresAt?.toISOString() ?? null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create school'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

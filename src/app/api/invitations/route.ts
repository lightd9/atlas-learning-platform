import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSchoolManager } from '@/lib/access'
import { createInvitationToken, invitationExpiry } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { roleInvitationEmail, sendEmail } from '@/lib/email'

const invitationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
})

const requestSchema = z.object({ invitations: z.array(invitationSchema).min(1).max(500), schoolId: z.string().optional(), role: z.enum(['TEACHER', 'HEADTEACHER', 'INSTRUCTOR', 'ATLAS_ADMIN']).default('TEACHER') })

export async function GET() {
  try {
    const manager = await requireSchoolManager()
    if (!manager.schoolId) return NextResponse.json({ invitations: [] })

    const invitations = await prisma.invitation.findMany({
      where: { schoolId: manager.schoolId },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const data = invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      name: inv.name,
      status: inv.expiresAt < new Date() && inv.status === 'PENDING' ? 'EXPIRED' : inv.status,
      invitedBy: inv.invitedBy.name,
      expiresAt: inv.expiresAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    }))

    return NextResponse.json({ invitations: data })
  } catch (error) {
    const message = error instanceof Error ? 'Unable to load invitations' : 'Unable to load invitations'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

export async function POST(request: Request) {
  try {
    const manager = await requireSchoolManager()
    const body = requestSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Provide between 1 and 500 valid teacher invitations.' }, { status: 400 })
    if (!manager.schoolId && manager.role !== 'ATLAS_ADMIN') return NextResponse.json({ error: 'A school is required.' }, { status: 400 })

    const schoolId = manager.role === 'ATLAS_ADMIN'
      ? body.data.schoolId ?? (await prisma.school.findFirst({ where: { active: true } }))?.id
      : manager.schoolId
    if (manager.role !== 'ATLAS_ADMIN' && body.data.role !== 'TEACHER') return NextResponse.json({ error: 'Only Atlas Admins can create platform roles.' }, { status: 403 })
    if ((body.data.role === 'TEACHER' || body.data.role === 'HEADTEACHER') && !schoolId) return NextResponse.json({ error: 'A school is required for school-role invitations.' }, { status: 400 })

    // Check for duplicates in the input
    const emails = body.data.invitations.map((i) => i.email)
    if (new Set(emails).size !== emails.length) return NextResponse.json({ error: 'Duplicate emails found in invitation list.' }, { status: 409 })

    // Check for existing users
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, status: true },
    })
    if (existingUsers.some((u) => u.status === 'ACTIVE')) {
      const activeEmails = existingUsers.filter((u) => u.status === 'ACTIVE').map((u) => u.email)
      return NextResponse.json({ error: `Some users already have active accounts: ${activeEmails.join(', ')}` }, { status: 409 })
    }

    // Check for existing pending invitations
    const existingInvitations = await prisma.invitation.findMany({
      where: { email: { in: emails }, status: 'PENDING', expiresAt: { gt: new Date() } },
      select: { email: true },
    })
    if (existingInvitations.length > 0) {
      return NextResponse.json({
        error: 'Some teachers already have pending invitations',
        pendingEmails: existingInvitations.map((i) => i.email),
      }, { status: 409 })
    }

    const expiresAt = invitationExpiry()
    const prepared = body.data.invitations.map((invitation) => ({ invitation, ...createInvitationToken() }))
    const created = await prisma.$transaction(prepared.map(({ invitation, tokenHash }) => prisma.invitation.create({
      data: { ...invitation, schoolId: body.data.role === 'TEACHER' || body.data.role === 'HEADTEACHER' ? schoolId : null, role: body.data.role, invitedById: manager.id, tokenHash, expiresAt },
        select: { id: true, email: true, name: true, expiresAt: true },
      })))
    const results = created.map((record, index) => ({ ...record, setupToken: prepared[index].rawToken }))
    const school = schoolId ? await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }) : null
    const emailDeliveries = await Promise.allSettled(results.map((record, index) => {
      const email = roleInvitationEmail({ name: record.name, role: body.data.role, schoolName: school?.name, setupToken: prepared[index].rawToken, invitedByName: manager.name })
      return sendEmail({ to: record.email, ...email, type: 'INVITATION' })
    }))
    await Promise.all(results.map((record) => auditLog({ action: 'INVITATION.CREATE', userId: manager.id, schoolId: schoolId ?? undefined, details: `Invitation created for ${record.email}` })))
    return NextResponse.json({ invitations: results, emailDelivery: { sent: emailDeliveries.filter((delivery) => delivery.status === 'fulfilled').length, failed: emailDeliveries.filter((delivery) => delivery.status === 'rejected').length } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create invitations'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

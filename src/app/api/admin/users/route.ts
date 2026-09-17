import { NextResponse } from 'next/server'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { createInvitationToken, invitationExpiry, INVITATION_RESEND_COOLDOWN_MS } from '@/lib/invitations'
import { roleInvitationEmail, sendEmail } from '@/lib/email'

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(['ATLAS_ADMIN', 'ATLAS_EMPLOYEE', 'INSTRUCTOR', 'HEADTEACHER']),
  schoolId: z.string().optional(),
  permissions: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    await requireAtlasAdmin()
    const users = await prisma.user.findMany({
      include: { school: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      schoolName: u.school?.name ?? null,
      lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
    }))
    return NextResponse.json({ users: data })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load users'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAtlasAdmin()
    const body = createSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Enter a valid name, email and role.' }, { status: 400 })
    if (body.data.role === 'HEADTEACHER' && !body.data.schoolId) return NextResponse.json({ error: 'Select a school for a headteacher.' }, { status: 400 })
    const existing = await prisma.user.findUnique({ where: { email: body.data.email } })
    if (existing?.status === 'ACTIVE') return NextResponse.json({ error: 'A user with this email already has an active account.' }, { status: 409 })
    const latestPending = await prisma.invitation.findFirst({ where: { email: body.data.email, status: 'PENDING' }, orderBy: { createdAt: 'desc' } })
    if (latestPending && Date.now() - latestPending.createdAt.getTime() < INVITATION_RESEND_COOLDOWN_MS) return NextResponse.json({ error: 'A pending invitation already exists for this email. Please wait for an hour before trying again.' }, { status: 409 })
    const { rawToken, tokenHash } = createInvitationToken()
    const expiresAt = invitationExpiry()
    const invitation = latestPending
      ? await prisma.invitation.update({ where: { id: latestPending.id }, data: { tokenHash, expiresAt, status: 'PENDING' } })
      : await prisma.invitation.create({
          data: { name: body.data.name, email: body.data.email, role: body.data.role, permissions: body.data.role === 'ATLAS_EMPLOYEE' ? body.data.permissions : [], schoolId: body.data.role === 'HEADTEACHER' ? body.data.schoolId : null, invitedById: admin.id, tokenHash, expiresAt },
        })
    const school = invitation.schoolId ? await prisma.school.findUnique({ where: { id: invitation.schoolId }, select: { name: true } }) : null
    const email = roleInvitationEmail({ name: invitation.name, role: invitation.role, setupToken: rawToken, invitedByName: admin.name, schoolName: school?.name })
    let emailDelivery: 'sent' | 'failed' = 'sent'
    try { await sendEmail({ to: invitation.email, ...email, type: 'INVITATION' }) } catch { emailDelivery = 'failed' }
    return NextResponse.json({ invitation: { id: invitation.id, name: invitation.name, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt.toISOString() }, setupUrl: `/setup/${rawToken}`, emailDelivery }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create user invitation'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

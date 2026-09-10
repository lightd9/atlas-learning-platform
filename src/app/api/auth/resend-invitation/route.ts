import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createInvitationToken } from '@/lib/invitations'
import { headteacherSetupEmail, invitationResendEmail, sendEmail } from '@/lib/email'
import { auditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) })

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    if (!(await rateLimit(`invitation-resend:${body.data.email}`, 3, 15 * 60 * 1000)).allowed) return NextResponse.json({ sent: true })

    const invitation = await prisma.invitation.findFirst({ where: { email: body.data.email, status: { in: ['PENDING', 'EXPIRED'] } }, orderBy: { createdAt: 'desc' } })
    if (!invitation) return NextResponse.json({ sent: true })

    const { rawToken, tokenHash } = createInvitationToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.invitation.update({ where: { id: invitation.id }, data: { tokenHash, expiresAt, status: 'PENDING' } })
    const school = invitation.schoolId ? await prisma.school.findUnique({ where: { id: invitation.schoolId }, select: { name: true } }) : null
    const email = invitation.role === 'HEADTEACHER'
      ? headteacherSetupEmail(invitation.name, school?.name ?? 'your school', rawToken)
      : invitationResendEmail(invitation.name, school?.name ?? 'your school', rawToken)
    await sendEmail({ to: invitation.email, ...email, type: 'INVITATION.RESEND_REQUEST' })
    await auditLog({ action: 'INVITATION.RESEND_REQUEST', userId: invitation.invitedById, schoolId: invitation.schoolId ?? undefined, details: `Self-service resend requested for ${invitation.email}` })
    return NextResponse.json({ sent: true })
  } catch {
    return NextResponse.json({ sent: true })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { INVITATION_RESEND_COOLDOWN_MS } from '@/lib/invitations'
import { deliverInvitationResend } from '@/lib/invitation-delivery'
import { evaluateInvitationResend } from '@/lib/invitation-resend'
import { auditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) })

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    if (!(await rateLimit(`invitation-resend:${body.data.email}`, 3, 15 * 60 * 1000)).allowed) return NextResponse.json({ sent: true })

    const invitation = await prisma.invitation.findFirst({
      where: { email: { equals: body.data.email, mode: 'insensitive' }, status: { in: ['PENDING', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' }, include: { school: { select: { name: true } } },
    })
    if (!invitation) return NextResponse.json({ sent: true })
    const account = await prisma.user.findFirst({ where: { email: { equals: body.data.email, mode: 'insensitive' } }, select: { email: true } })
    const evaluation = evaluateInvitationResend(invitation, {
      now: new Date(), existingAccountEmails: new Set(account ? [account.email] : []), cooldownMs: INVITATION_RESEND_COOLDOWN_MS,
    })
    if (!evaluation.eligible) return NextResponse.json({ sent: true })
    // Share token reservation/restoration with manager resends. Failed email
    // delivery must not invalidate the invitee's previous setup link.
    await deliverInvitationResend(invitation, 'INVITATION.RESEND_REQUEST')
    await auditLog({ action: 'INVITATION.RESEND_REQUEST', userId: invitation.invitedById, schoolId: invitation.schoolId ?? undefined, details: `Self-service resend requested for ${invitation.email}` })
    return NextResponse.json({ sent: true })
  } catch {
    return NextResponse.json({ sent: true })
  }
}

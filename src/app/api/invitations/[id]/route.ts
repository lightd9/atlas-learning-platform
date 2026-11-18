import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSchoolManager } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { auditLog } from '@/lib/audit'
import { deliverInvitationResend, resendFailureMessage } from '@/lib/invitation-delivery'
import { evaluateInvitationResend } from '@/lib/invitation-resend'
import { INVITATION_RESEND_COOLDOWN_MS } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'

const resendSchema = z.object({
  action: z.enum(['resend']).default('resend'),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { id } = await params
    const body = resendSchema.safeParse(await request.json().catch(() => ({})))
    if (!body.success) return NextResponse.json({ error: 'Invalid resend request.' }, { status: 400 })

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      include: { school: { select: { id: true, name: true } } },
    })
    if (!invitation) return NextResponse.json({ error: 'Invitation not found', reason: 'NOT_FOUND' }, { status: 404 })
    if (invitation.schoolId !== manager.schoolId && manager.role !== 'ATLAS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingAccount = await prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: 'insensitive' } },
      select: { email: true },
    })
    const evaluation = evaluateInvitationResend(invitation, {
      now: new Date(),
      existingAccountEmails: new Set(existingAccount ? [existingAccount.email] : []),
      cooldownMs: INVITATION_RESEND_COOLDOWN_MS,
    })
    if (!evaluation.eligible) {
      return NextResponse.json({
        error: resendFailureMessage(evaluation.reason),
        reason: evaluation.reason,
        status: evaluation.effectiveStatus,
      }, { status: 409 })
    }

    const delivered = await deliverInvitationResend(invitation)
    await auditLog({
      action: 'INVITATION.RESEND',
      userId: manager.id,
      schoolId: invitation.schoolId ?? undefined,
      details: `Invitation resent to ${invitation.email}`,
    })

    return NextResponse.json({ invitation: { id, setupToken: delivered.setupToken, expiresAt: delivered.expiresAt.toISOString() } })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to resend invitation')
  }
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { id } = await params
    const invitation = await prisma.invitation.findUnique({ where: { id } })
    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (manager.role !== 'ATLAS_ADMIN' && invitation.schoolId !== manager.schoolId) throw new Error('FORBIDDEN')
    if (invitation.status === 'ACCEPTED') return NextResponse.json({ error: 'This invitation was already accepted.' }, { status: 409 })
    if (invitation.status === 'REVOKED') return NextResponse.json({ success: true })
    const revoked = await prisma.invitation.updateMany({ where: { id, status: { in: ['PENDING', 'EXPIRED'] } }, data: { status: 'REVOKED' } })
    if (revoked.count !== 1) return NextResponse.json({ error: 'This invitation changed. Refresh the list before trying again.' }, { status: 409 })
    await auditLog({ action: 'INVITATION.REVOKE', userId: manager.id, schoolId: invitation.schoolId ?? undefined, details: `Invitation revoked for ${invitation.email}` })
    return NextResponse.json({ success: true })
  } catch (error) { return apiErrorResponse(error, 'Unable to revoke invitation') }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { id } = await params

    const invitation = await prisma.invitation.findUnique({ where: { id } })
    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invitation.schoolId !== manager.schoolId && manager.role !== 'ATLAS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.invitation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to delete invitation')
  }
}

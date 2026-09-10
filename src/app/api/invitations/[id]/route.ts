import { NextResponse } from 'next/server'
import { requireSchoolManager } from '@/lib/access'
import { createInvitationToken } from '@/lib/invitations'
import { prisma } from '@/lib/prisma'
import { invitationResendEmail, headteacherSetupEmail, sendEmail } from '@/lib/email'
import { auditLog } from '@/lib/audit'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { id } = await params

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      include: { school: { select: { id: true, name: true } } },
    })

    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invitation.schoolId !== manager.schoolId && manager.role !== 'ATLAS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Create a new token
    const { rawToken, tokenHash } = createInvitationToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt, status: 'PENDING', updatedAt: new Date() },
    })

    const email = invitation.role === 'HEADTEACHER'
      ? headteacherSetupEmail(invitation.name, invitation.school?.name ?? 'your school', rawToken)
      : invitationResendEmail(invitation.name, invitation.school?.name ?? 'your school', rawToken)
    await sendEmail({ to: invitation.email, ...email })
    await auditLog({ action: 'INVITATION.RESEND', userId: manager.id, schoolId: invitation.schoolId ?? undefined, details: `Invitation resent to ${invitation.email}` })

    return NextResponse.json({ invitation: { id, setupToken: rawToken, expiresAt: expiresAt.toISOString() } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to resend invitation'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
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

    await prisma.invitation.update({ where: { id }, data: { status: 'REVOKED' } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to revoke invitation' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAtlasAdmin } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { resendInvitationBatch } from '@/lib/bulk-invitation-resend'
import { prisma } from '@/lib/prisma'

const bulkResendSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
})

export async function GET() {
  try {
    await requireAtlasAdmin()
    const invitations = await prisma.invitation.findMany({
      where: { status: { in: ['PENDING', 'EXPIRED', 'REVOKED'] } },
      include: { school: { select: { name: true } }, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const now = Date.now()
    const data = invitations.map((inv) => ({
      id: inv.id,
      name: inv.name,
      email: inv.email,
      role: inv.role,
      status: inv.status === 'PENDING' && inv.expiresAt.getTime() < now ? 'EXPIRED' : inv.status,
      schoolName: inv.school?.name ?? null,
      invitedBy: inv.invitedBy.name,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }))
    return NextResponse.json({ invitations: data })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load invitations')
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAtlasAdmin()
    const body = bulkResendSchema.safeParse(await request.json().catch(() => null))
    if (!body.success) return NextResponse.json({ error: 'Select at least one invitation to resend.' }, { status: 400 })

    return NextResponse.json(await resendInvitationBatch(admin, body.data.ids))
  } catch (error) {
    return apiErrorResponse(error, 'Unable to resend invitations')
  }
}

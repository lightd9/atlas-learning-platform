import { NextResponse } from 'next/server'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

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
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load invitations'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}
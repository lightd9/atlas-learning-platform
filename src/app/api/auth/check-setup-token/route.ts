import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashInvitationToken } from '@/lib/invitations'

const schema = z.object({
  token: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

    const tokenHash = hashInvitationToken(body.data.token)
    const invitation = await prisma.invitation.findFirst({
      where: { tokenHash, status: 'PENDING' },
      select: { id: true, name: true, email: true, expiresAt: true },
    })

    if (!invitation) return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    return NextResponse.json({ name: invitation.name, email: invitation.email })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
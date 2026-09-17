import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hashSync } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { hashInvitationToken } from '@/lib/invitations'
import { Prisma } from '@prisma/client'

const schema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
})

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const tokenHash = hashInvitationToken(body.data.token)
    const passwordHash = hashSync(body.data.password, 10)

    const invitation = await prisma.invitation.findFirst({
      where: { tokenHash, status: 'PENDING' },
      select: { id: true, email: true, expiresAt: true, role: true, schoolId: true, permissions: true },
    })

    if (!invitation) return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 })
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } })
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    const permissions = (invitation.permissions ?? []) as Prisma.InputJsonValue
    await prisma.$transaction([
      prisma.user.upsert({
        where: { email: invitation.email },
        update: { name: body.data.name, passwordHash, status: 'ACTIVE', role: invitation.role, permissions, schoolId: invitation.schoolId, lastActiveAt: new Date() },
        create: { email: invitation.email, name: body.data.name, passwordHash, role: invitation.role, permissions, schoolId: invitation.schoolId, status: 'ACTIVE' },
      }),
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}

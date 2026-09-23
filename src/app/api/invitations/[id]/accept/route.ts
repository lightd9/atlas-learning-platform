import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { requireSchoolManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'

const acceptSchema = z.object({
  password: z.string().min(8).max(128),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const manager = await requireSchoolManager()
    const { id } = await params

    const body = acceptSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, schoolId: true, role: true, permissions: true, status: true, acceptedById: true },
    })
    if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    if (invitation.schoolId !== manager.schoolId && manager.role !== 'ATLAS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (manager.role !== 'ATLAS_ADMIN' && invitation.role !== 'TEACHER') {
      return NextResponse.json({ error: 'You can only accept teacher invitations.' }, { status: 403 })
    }
    if (invitation.status === 'ACCEPTED' || invitation.acceptedById) return NextResponse.json({ error: 'Invitation has already been accepted.' }, { status: 409 })
    if (invitation.status === 'REVOKED') return NextResponse.json({ error: 'This invitation has been revoked.' }, { status: 409 })

    const passwordHash = await hash(body.data.password, 12)
    const permissions = (invitation.permissions ?? []) as Prisma.InputJsonValue

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.upsert({
        where: { email: invitation.email },
        update: { name: invitation.name, passwordHash, role: invitation.role, permissions, schoolId: invitation.schoolId, status: 'ACTIVE', mustChangePassword: false, lastActiveAt: new Date() },
        create: { email: invitation.email, name: invitation.name, passwordHash, role: invitation.role, permissions, schoolId: invitation.schoolId, status: 'ACTIVE' },
      })
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: created.id },
      })
      await tx.passwordResetToken.deleteMany({ where: { userId: created.id, usedAt: null } })
      return created
    })

    await auditLog({ action: 'INVITATION.ACCEPT', userId: manager.id, schoolId: invitation.schoolId ?? undefined, details: `Invitation accepted for ${invitation.email} by ${manager.name}` })

    return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to accept invitation'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}
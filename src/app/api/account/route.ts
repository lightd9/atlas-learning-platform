import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const schema = z.object({ currentPassword: z.string().min(1), confirmation: z.literal('DELETE') })

export async function DELETE(request: Request) {
  try {
    const user = await requireSchoolUser()
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Type DELETE and provide your current password.' }, { status: 400 })
    if (!user.passwordHash || !(await compare(body.data.currentPassword, user.passwordHash))) return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 })
    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { OR: [{ email: user.email }, { invitedById: user.id }] } }),
      prisma.user.delete({ where: { id: user.id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to delete account'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 })
  }
}

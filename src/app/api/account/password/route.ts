import { NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

export async function PATCH(request: Request) {
  try {
    const user = await requireSchoolUser()
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Use a new password with at least 8 characters.' }, { status: 400 })
    if (!user.passwordHash || !(await compare(body.data.currentPassword, user.passwordHash))) return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 })
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(body.data.newPassword, 12) } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update password'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'

const schema = z.object({
  newPassword: z.string().min(8).max(128),
})

export async function POST(request: Request) {
  try {
    const user = await requireSchoolUser()
    if (!user.mustChangePassword) return NextResponse.json({ error: 'Your password does not need to be changed.' }, { status: 400 })
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Use a new password with at least 8 characters.' }, { status: 400 })
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(body.data.newPassword, 12), mustChangePassword: false, status: 'ACTIVE' } })
    await auditLog({ action: 'USER.PROFILE_UPDATE', userId: user.id, details: 'Password changed (must-change)' })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update password'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}
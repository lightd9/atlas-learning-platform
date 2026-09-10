import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
})

export async function GET() {
  try {
    const user = await requireSchoolUser()
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, schoolId: user.schoolId } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load profile'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSchoolUser()
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Enter a valid name and email address.' }, { status: 400 })

    const email = body.data.email.toLowerCase()
    const name = body.data.name

    if (email !== user.email.toLowerCase()) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return NextResponse.json({ error: 'That email address is already in use.' }, { status: 409 })
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data: { name, email } })
    await auditLog({ action: 'USER.PROFILE_UPDATE', userId: user.id, schoolId: user.schoolId ?? undefined, details: `Profile updated (${name}${email !== user.email.toLowerCase() ? `, email changed` : ''})` })

    return NextResponse.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, schoolId: updated.schoolId } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update profile'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

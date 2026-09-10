import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createInvitationToken } from '@/lib/invitations'
import { passwordResetEmail, sendEmail } from '@/lib/email'
import { auditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
})

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    if (!(await rateLimit(`password-reset:${body.data.email}`, 5, 15 * 60 * 1000)).allowed) return NextResponse.json({ sent: true })

    const user = await prisma.user.findUnique({ where: { email: body.data.email }, select: { id: true, email: true, name: true, passwordHash: true } })
    if (!user || !user.passwordHash) return NextResponse.json({ sent: true })

    const { rawToken, tokenHash } = createInvitationToken()
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } })
    const email = passwordResetEmail(user.name, rawToken)
    await sendEmail({ to: user.email, ...email })
    await auditLog({ action: 'ADMIN.ACTION', userId: user.id, details: 'Password reset requested' })

    return NextResponse.json({ sent: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

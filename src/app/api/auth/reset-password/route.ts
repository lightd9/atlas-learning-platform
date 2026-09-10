import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hashSync } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { hashInvitationToken } from '@/lib/invitations'
import { rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  email: z.string().email().transform((v) => v.toLowerCase()),
})

export async function POST(request: Request) {
  try {
    const body = schema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    if (!(await rateLimit(`password-reset-submit:${body.data.email}`, 8, 15 * 60 * 1000)).allowed) return NextResponse.json({ error: 'Too many reset attempts. Please request a new link later.' }, { status: 429 })

    const tokenHash = hashInvitationToken(body.data.token)
    const passwordHash = hashSync(body.data.password, 10)

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
      include: { user: { select: { id: true, email: true } } },
    })

    if (!resetToken) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    if (resetToken.expiresAt < new Date()) return NextResponse.json({ error: 'Reset link has expired' }, { status: 400 })
    if (resetToken.user.email !== body.data.email) return NextResponse.json({ error: 'Email does not match' }, { status: 400 })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.user.id },
        data: { passwordHash, status: 'ACTIVE', lastActiveAt: new Date() },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

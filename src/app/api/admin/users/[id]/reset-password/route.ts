import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { requireUserPasswordResetAccess } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'
import { generateTemporaryPassword } from '@/lib/passwords'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireUserPasswordResetAccess()
    const { id } = await params
    if (id === admin.id) return NextResponse.json({ error: 'You cannot reset your own password.' }, { status: 400 })

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const temporaryPassword = generateTemporaryPassword()
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hash(temporaryPassword, 12), mustChangePassword: true } }),
    ])
    await auditLog({ action: 'ADMIN.ACTION', userId: admin.id, details: `Password reset for ${user.email}` })

    return NextResponse.json({ success: true, temporaryPassword, user: { id: user.id, name: user.name } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to reset password'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}
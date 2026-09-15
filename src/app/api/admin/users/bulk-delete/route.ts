import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const bulkSchema = z.object({
  userIds: z.array(z.string()).default([]),
  invitationIds: z.array(z.string()).default([]),
})

export async function POST(request: Request) {
  try {
    const admin = await requireAtlasAdmin()
    const body = bulkSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    const { userIds, invitationIds } = body.data
    if (userIds.length === 0 && invitationIds.length === 0) return NextResponse.json({ error: 'Select at least one user or invitation to delete.' }, { status: 400 })
    if (userIds.includes(admin.id)) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })

    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    await prisma.$transaction([
      ...(invitationIds.length > 0 ? [prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } })] : []),
      ...users.map((user) => prisma.invitation.deleteMany({ where: { OR: [{ email: user.email }, { invitedById: user.id }] } })),
      ...users.map((user) => prisma.user.delete({ where: { id: user.id } })),
    ])
    return NextResponse.json({ deletedUsers: users.length, deletedInvitations: invitationIds.length })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to delete users'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}
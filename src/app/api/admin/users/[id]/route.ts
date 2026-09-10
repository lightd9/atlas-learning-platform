import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

const updateSchema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAtlasAdmin()
    const { id } = await params
    if (id === admin.id) return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 })
    const body = updateSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid user status.' }, { status: 400 })
    const user = await prisma.user.update({ where: { id }, data: { status: body.data.status } })
    return NextResponse.json({ user: { id: user.id, status: user.status } })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to update user'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAtlasAdmin()
    const { id } = await params
    if (id === admin.id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    await prisma.$transaction([
      prisma.invitation.deleteMany({ where: { invitedById: id } }),
      prisma.user.delete({ where: { id } }),
    ])
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to delete user'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

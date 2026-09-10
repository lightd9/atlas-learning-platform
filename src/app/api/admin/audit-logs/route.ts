import { NextResponse } from 'next/server'
import { requireAtlasAdmin } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    await requireAtlasAdmin()
    const searchParams = new URL(request.url).searchParams
    const schoolId = searchParams.get('schoolId') || undefined
    const search = searchParams.get('search')?.trim() || undefined
    const logs = await prisma.auditLog.findMany({
      where: {
        schoolId,
        ...(search ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { details: { contains: search, mode: 'insensitive' } },
            { user: { name: { contains: search, mode: 'insensitive' } } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
            { school: { name: { contains: search, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        school: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    })
    return NextResponse.json({ logs })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load audit history'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

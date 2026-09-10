import { NextResponse } from 'next/server'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await requireSchoolUser()
    if (!user.schoolId) return NextResponse.json({ schoolName: null })

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    })

    return NextResponse.json({ schoolName: school?.name ?? null })
  } catch {
    return NextResponse.json({ schoolName: null })
  }
}

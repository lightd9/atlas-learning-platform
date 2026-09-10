import { NextResponse } from 'next/server'
import { requireSchoolManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const accessSchema = z.object({
  courseId: z.string().min(1),
  schoolId: z.string().min(1),
  enabled: z.boolean(),
})

export async function POST(request: Request) {
  try {
    const manager = await requireSchoolManager()
    const body = accessSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    if (manager.schoolId !== body.data.schoolId && manager.role !== 'ATLAS_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existing = await prisma.schoolCourse.findUnique({
      where: { schoolId_courseId: { schoolId: body.data.schoolId, courseId: body.data.courseId } },
    })

    if (existing) {
      await prisma.schoolCourse.update({
        where: { schoolId_courseId: { schoolId: body.data.schoolId, courseId: body.data.courseId } },
        data: { enabled: body.data.enabled },
      })
    } else {
      await prisma.schoolCourse.create({
        data: { schoolId: body.data.schoolId, courseId: body.data.courseId, enabled: body.data.enabled },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to update access' }, { status: 500 })
  }
}
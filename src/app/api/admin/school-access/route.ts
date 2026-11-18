import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/access'
import { planCourseSchoolSelection, planSchoolCourseSelection } from '@/lib/school-access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const accessSchema = z.object({
  schoolId: z.string().min(1),
  courseId: z.string().min(1),
  enabled: z.boolean(),
})

const bulkAccessSchema = z.object({
  courseId: z.string().min(1),
  schoolIds: z.array(z.string()),
})

const schoolCourseSelectionSchema = z.object({
  schoolId: z.string().min(1),
  courseIds: z.array(z.string()),
  audience: z.enum(['STAFF', 'PARENT']).optional(),
})

export async function POST(request: Request) {
  try {
      await requirePermission('SCHOOL_ASSIGN')
    const body = accessSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

    const existing = await prisma.schoolCourse.findUnique({
      where: { schoolId_courseId: { schoolId: body.data.schoolId, courseId: body.data.courseId } },
    })

    if (existing) {
      await prisma.schoolCourse.update({
        where: { schoolId_courseId: { schoolId: body.data.schoolId, courseId: body.data.courseId } },
        data: { enabled: body.data.enabled },
      })
    } else {
      await prisma.schoolCourse.create({ data: { schoolId: body.data.schoolId, courseId: body.data.courseId, enabled: body.data.enabled } })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to update access' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await requirePermission('SCHOOL_ASSIGN')
    const rawBody = await request.json()
    const schoolSelection = schoolCourseSelectionSchema.safeParse(rawBody)
    if (schoolSelection.success) {
      const school = await prisma.school.findUnique({ where: { id: schoolSelection.data.schoolId }, select: { id: true, active: true } })
      if (!school || !school.active) return NextResponse.json({ error: 'Active school not found.' }, { status: 404 })
      const audience = schoolSelection.data.audience ?? 'STAFF'
      const courses = await prisma.course.findMany({ where: { audience }, select: { id: true, audience: true } })
      const plan = planSchoolCourseSelection({
        schoolId: school.id,
        courses: courses.map((course) => ({ id: course.id, audience: course.audience as 'STAFF' | 'PARENT' })),
        selectedCourseIds: schoolSelection.data.courseIds,
      })
      await prisma.$transaction(async (tx) => {
        for (const key of plan.deletes) {
          await tx.schoolCourse.deleteMany({ where: key })
        }
        for (const row of plan.upserts) {
          await tx.schoolCourse.upsert({
            where: { schoolId_courseId: { schoolId: row.schoolId, courseId: row.courseId } },
            update: { enabled: row.enabled },
            create: { schoolId: row.schoolId, courseId: row.courseId, enabled: row.enabled },
          })
        }
      })
      return NextResponse.json({ success: true, selectedCourseCount: schoolSelection.data.courseIds.length })
    }

    const body = bulkAccessSchema.safeParse(rawBody)
    if (!body.success) return NextResponse.json({ error: 'Invalid school selection.' }, { status: 400 })
    const [course, schools] = await Promise.all([
      prisma.course.findUnique({ where: { id: body.data.courseId }, select: { audience: true } }),
      prisma.school.findMany({ where: { active: true }, select: { id: true } }),
    ])
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 })
    const plan = planCourseSchoolSelection({
      courseId: body.data.courseId,
      courseAudience: course.audience as 'STAFF' | 'PARENT',
      schools,
      selectedSchoolIds: body.data.schoolIds,
    })
    await prisma.$transaction(async (tx) => {
      for (const key of plan.deletes) {
        await tx.schoolCourse.deleteMany({ where: key })
      }
      for (const row of plan.upserts) {
        await tx.schoolCourse.upsert({
          where: { schoolId_courseId: { schoolId: row.schoolId, courseId: row.courseId } },
          update: { enabled: row.enabled },
          create: { schoolId: row.schoolId, courseId: row.courseId, enabled: row.enabled },
        })
      }
    })
    return NextResponse.json({ success: true, selectedSchoolCount: body.data.schoolIds.length })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to save course access' }, { status: 500 })
  }
}

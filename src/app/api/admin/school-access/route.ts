import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/access'
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
      const courses = await prisma.course.findMany({ select: { id: true } })
      const selected = new Set(schoolSelection.data.courseIds)
      await prisma.$transaction(async (tx) => {
        // All courses selected means restore the default: available to this
        // school without storing unnecessary overrides.
        if (selected.size === courses.length && courses.every((course) => selected.has(course.id))) {
          await tx.schoolCourse.deleteMany({ where: { schoolId: school.id } })
          return
        }
        for (const course of courses) {
          await tx.schoolCourse.upsert({
            where: { schoolId_courseId: { schoolId: school.id, courseId: course.id } },
            update: { enabled: selected.has(course.id) },
            create: { schoolId: school.id, courseId: course.id, enabled: selected.has(course.id) },
          })
        }
      })
      return NextResponse.json({ success: true, selectedCourseCount: selected.size })
    }

    const body = bulkAccessSchema.safeParse(rawBody)
    if (!body.success) return NextResponse.json({ error: 'Invalid school selection.' }, { status: 400 })
    const schools = await prisma.school.findMany({ where: { active: true }, select: { id: true } })
    const selected = new Set(body.data.schoolIds)
    await prisma.$transaction(async (tx) => {
      // All selected means restore the global default and remove overrides.
      if (selected.size === schools.length && schools.every((school) => selected.has(school.id))) {
        await tx.schoolCourse.deleteMany({ where: { courseId: body.data.courseId } })
        return
      }
      for (const school of schools) {
        await tx.schoolCourse.upsert({
          where: { schoolId_courseId: { schoolId: school.id, courseId: body.data.courseId } },
          update: { enabled: selected.has(school.id) },
          create: { schoolId: school.id, courseId: body.data.courseId, enabled: selected.has(school.id) },
        })
      }
    })
    return NextResponse.json({ success: true, selectedSchoolCount: selected.size })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to save course access' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnedCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-errors'

const lessonSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  durationSeconds: z.number().int().min(0),
  muxPlaybackId: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().min(0),
  published: z.boolean().default(true),
})

const moduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0),
  lessons: z.array(lessonSchema),
})

const contentSchema = z.object({ modules: z.array(moduleSchema) })

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireOwnedCourseEditor(id)
    const course = await prisma.course.findUnique({ where: { id }, include: { modules: { include: { lessons: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } } } })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    return NextResponse.json({ modules: course.modules })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load course content')
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    await requireOwnedCourseEditor(courseId)
    const body = contentSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Each module and lesson needs a title and valid order.', details: body.error.flatten() }, { status: 400 })

    const existing = await prisma.course.findUnique({ where: { id: courseId }, include: { modules: { include: { lessons: true } } } })
    if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const existingModules = new Map(existing.modules.map((module) => [module.id, module]))
    const hasForeignIdentifiers = body.data.modules.some((module) => {
      if (!module.id) return module.lessons.some((lesson) => lesson.id)
      const existingModule = existingModules.get(module.id)
      if (!existingModule) return true
      const lessonIds = new Set(existingModule.lessons.map((lesson) => lesson.id))
      return module.lessons.some((lesson) => lesson.id && !lessonIds.has(lesson.id))
    })
    if (hasForeignIdentifiers) return NextResponse.json({ error: 'Course content contains invalid module or lesson identifiers.' }, { status: 400 })

    const incomingModuleIds = body.data.modules.flatMap((module) => module.id ? [module.id] : [])
    const incomingLessonIds = body.data.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.id ? [lesson.id] : []))
    await prisma.$transaction(async (tx) => {
      await tx.lesson.deleteMany({ where: { moduleId: { in: existing.modules.map((module) => module.id) }, id: { notIn: incomingLessonIds } } })
      await tx.courseModule.deleteMany({ where: { courseId, id: { notIn: incomingModuleIds } } })
      for (const module of body.data.modules) {
        const savedModule = module.id
          ? await tx.courseModule.update({ where: { id: module.id, courseId }, data: { title: module.title, description: module.description || null, sortOrder: module.sortOrder } })
          : await tx.courseModule.create({ data: { courseId, title: module.title, description: module.description || null, sortOrder: module.sortOrder } })
        for (const lesson of module.lessons) {
          const data = { title: lesson.title, description: lesson.description || null, durationSeconds: lesson.durationSeconds, muxPlaybackId: lesson.muxPlaybackId || null, sortOrder: lesson.sortOrder, published: lesson.published }
          if (lesson.id) await tx.lesson.update({ where: { id: lesson.id, moduleId: savedModule.id }, data })
          else await tx.lesson.create({ data: { ...data, moduleId: savedModule.id } })
        }
      }
    })
    const modules = await prisma.courseModule.findMany({ where: { courseId }, include: { lessons: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } })
    return NextResponse.json({ modules })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to save course content')
  }
}

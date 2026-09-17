import { NextResponse } from 'next/server'
import { requireCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().default(0),
  muxPlaybackId: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
})

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  url: z.string().trim().url(),
  fileName: z.string().trim().max(200).optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
})

const moduleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  lessons: z.array(lessonSchema).default([]),
})

const courseSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  durationSeconds: z.number().int().nonnegative().default(0),
  published: z.boolean().default(true),
  muxPlaybackId: z.string().optional(),
  sectionId: z.string().nullable().optional(),
  notes: z.string().max(10000).optional().or(z.literal('')),
  resources: z.array(resourceSchema).default([]),
  modules: z.array(moduleSchema).default([]),
})

export async function GET() {
  try {
    const editor = await requireCourseEditor()
    const [courses, totalActiveSchools] = await Promise.all([prisma.course.findMany({
      where: editor.role === 'INSTRUCTOR' ? { createdById: editor.id } : undefined,
      include: {
        _count: { select: { progress: true, modules: true } },
        schoolAccess: { select: { enabled: true } },
        section: { select: { id: true, name: true, slug: true, description: true, sortOrder: true } },
      },
      orderBy: { createdAt: 'desc' },
    }), prisma.school.count({ where: { active: true } })])
    const data = courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      description: c.description,
      durationMinutes: c.durationMinutes,
      durationSeconds: c.durationSeconds,
      published: c.published,
      muxPlaybackId: c.muxPlaybackId,
      sectionId: c.sectionId,
      section: c.section,
      schoolAccessCount: Math.max(0, totalActiveSchools - c.schoolAccess.filter((access) => !access.enabled).length),
      progressCount: c._count.progress,
      moduleCount: c._count.modules,
      createdAt: c.createdAt.toISOString(),
      createdById: c.createdById,
    }))
    return NextResponse.json({ courses: data })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load courses'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(request: Request) {
  try {
    const editor = await requireCourseEditor()
    const body = courseSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid course data', details: body.error.flatten() }, { status: 400 })

    const existing = await prisma.course.findUnique({ where: { slug: body.data.slug } })
    if (existing) return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })

    const { modules, resources, ...courseData } = body.data
    const course = await prisma.course.create({
      data: {
        ...courseData,
        createdById: editor.id,
        published: editor.role === 'ATLAS_ADMIN' ? courseData.published : false,
        modules: {
          create: modules.map((mod) => ({
            title: mod.title,
            description: mod.description,
            sortOrder: mod.sortOrder,
            lessons: {
              create: mod.lessons.map((lesson) => ({
                title: lesson.title,
                description: lesson.description,
                durationSeconds: lesson.durationSeconds,
                muxPlaybackId: lesson.muxPlaybackId,
                sortOrder: lesson.sortOrder,
              })),
            },
          })),
        },
        resources: {
          create: resources.map((resource) => ({ ...resource, description: resource.description || null, fileName: resource.fileName || null })),
        },
      },
    })
    return NextResponse.json({ course }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create course'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

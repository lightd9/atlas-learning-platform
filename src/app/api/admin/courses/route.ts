import { NextResponse } from 'next/server'
import { requireCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog } from '@/lib/audit'

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
  coverImageUrl: z.string().trim().url().optional().or(z.literal('')),
  durationMinutes: z.number().int().nonnegative().default(0),
  durationSeconds: z.number().int().nonnegative().default(0),
  muxPlaybackId: z.string().trim().max(200).optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
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
      coverImageUrl: c.coverImageUrl,
      durationMinutes: c.durationMinutes,
      durationSeconds: c.durationSeconds,
      published: c.published,
      status: c.status,
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
    const lessonDurationSeconds = modules.reduce((courseTotal, module) => courseTotal + module.lessons.reduce((moduleTotal, lesson) => moduleTotal + lesson.durationSeconds, 0), 0)
    const durationSeconds = lessonDurationSeconds > 0 ? lessonDurationSeconds : courseData.durationSeconds
    const requestedStatus = 'DRAFT'
    const standaloneModule = courseData.muxPlaybackId && modules.length === 0 ? [{ title: 'Course video', description: 'Standalone course video', sortOrder: 0, lessons: [{ title: courseData.title, description: courseData.description, durationSeconds, muxPlaybackId: courseData.muxPlaybackId, sortOrder: 0 }] }] : modules
    const { muxPlaybackId: coursePlaybackId, ...persistedCourseData } = courseData
    const course = await prisma.course.create({
      data: {
        ...persistedCourseData,
        muxPlaybackId: coursePlaybackId || null,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        createdById: editor.id,
        status: requestedStatus,
        published: false,
        modules: {
          create: standaloneModule.map((mod) => ({
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
    await auditLog({ action: 'COURSE.CREATE', userId: editor.id, details: `Course created: ${course.title} (${course.id})` })
    return NextResponse.json({ course }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'You are not authorized to create courses.' }, { status: 401 })
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: 'A course with this URL slug already exists.', field: 'slug', suggestion: 'Choose a different slug and try again.' }, { status: 409 })
    console.error('Course creation failed', error)
    return NextResponse.json({ error: 'The course could not be created.', suggestion: 'Check the required fields, ensure the slug is unique, and try again.' }, { status: 500 })
  }
}

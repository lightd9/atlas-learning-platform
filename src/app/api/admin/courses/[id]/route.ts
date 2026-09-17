import { NextResponse } from 'next/server'
import { requireOwnedCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/api-errors'

const cleanNullable = (value: unknown) => (value === '' ? null : value)

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  coverImageUrl: z.preprocess(cleanNullable, z.string().url().nullable().optional()),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  published: z.boolean().optional(), // Legacy compatibility for existing callers.
  sectionId: z.preprocess(cleanNullable, z.string().nullable().optional()),
  notes: z.preprocess(cleanNullable, z.string().max(10000).nullable().optional()),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireOwnedCourseEditor(id)
    // Keep the required course lookup independent from optional learning
    // materials. A course must still be editable/previewable when it has no
    // notes or resources, and this also keeps older records compatible while
    // the optional materials migration is being rolled out.
    let course = await prisma.course.findUnique({
      where: { id },
      include: {
        schoolAccess: { include: { school: { select: { id: true, name: true } } } },
        section: { select: { id: true, name: true, slug: true, description: true, sortOrder: true } },
      },
    })
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    let resources: typeof course extends { resources: infer R } ? R : unknown[] = []
    try {
      resources = await prisma.courseResource.findMany({ where: { courseId: id }, orderBy: { sortOrder: 'asc' } })
    } catch (resourceError) {
      // Resources are optional. Do not make the entire course unavailable if
      // the optional table is temporarily unavailable or empty.
      console.warn('Unable to load optional course resources', resourceError)
    }

    return NextResponse.json({ course: { ...course, resources } })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load course')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const editor = await requireOwnedCourseEditor(id)
    const body = updateSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    const requestedStatus = body.data.status ?? (body.data.published === undefined ? undefined : body.data.published ? 'PUBLISHED' : 'DRAFT')
    const status = editor.role === 'INSTRUCTOR'
      ? requestedStatus === 'REVIEW' ? 'REVIEW' : 'DRAFT'
      : requestedStatus
    const { published: _legacyPublished, ...updateData } = body.data
    const data = { ...updateData, ...(status ? { status, published: status === 'PUBLISHED' } : {}) }
    const course = await prisma.course.update({ where: { id }, data })
    return NextResponse.json({ course })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update course')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireOwnedCourseEditor(id)
    await prisma.course.delete({ where: { id } })
    return NextResponse.json({ message: 'Course permanently deleted' })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to delete course')
  }
}

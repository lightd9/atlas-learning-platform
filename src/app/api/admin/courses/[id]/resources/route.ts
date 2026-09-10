import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnedCourseEditor } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { apiErrorResponse } from '@/lib/api-errors'

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  url: z.string().trim().url(),
  fileName: z.string().trim().max(200).optional().or(z.literal('')),
  sortOrder: z.number().int().nonnegative().default(0),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    await requireOwnedCourseEditor(courseId)
    const body = resourceSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Provide a title and valid downloadable URL.' }, { status: 400 })
    const resource = await prisma.courseResource.create({ data: { courseId, ...body.data, description: body.data.description || null, fileName: body.data.fileName || null } })
    return NextResponse.json({ resource }, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to add resource')
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    await requireOwnedCourseEditor(courseId)
    const body = z.object({ resourceId: z.string(), ...resourceSchema.shape }).safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Invalid resource data.' }, { status: 400 })
    const resource = await prisma.courseResource.update({ where: { id: body.data.resourceId, courseId }, data: { title: body.data.title, description: body.data.description || null, url: body.data.url, fileName: body.data.fileName || null, sortOrder: body.data.sortOrder } })
    return NextResponse.json({ resource })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update resource')
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    await requireOwnedCourseEditor(courseId)
    const resourceId = new URL(request.url).searchParams.get('resourceId')
    if (!resourceId) return NextResponse.json({ error: 'Resource is required.' }, { status: 400 })
    await prisma.courseResource.delete({ where: { id: resourceId, courseId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, 'Unable to delete resource')
  }
}

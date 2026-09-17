import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOwnedCourseEditor } from '@/lib/access'
import { getMuxClient } from '@/lib/mux'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string; lessonId: string }> }

async function getLesson(courseId: string, lessonId: string) {
  return prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId } },
    select: { id: true, module: { select: { courseId: true } } },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: courseId, lessonId } = await params
    const user = await requireOwnedCourseEditor(courseId)
    if (!await getLesson(courseId, lessonId)) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    const mux = getMuxClient()
    if (!mux) return NextResponse.json({ error: 'Mux is not configured' }, { status: 503 })

    const body = z.object({ filename: z.string().trim().max(255).optional(), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024 * 1024).optional() }).safeParse(await request.json().catch(() => ({})))
    if (!body.success) return NextResponse.json({ error: 'Invalid video metadata' }, { status: 400 })

    const uploadRecord = await prisma.muxUpload.create({ data: { courseId, lessonId, requestedById: user.id, filename: body.data.filename, sizeBytes: body.data.sizeBytes, status: 'CREATING' } })
    try {
      const upload = await mux.createDirectUpload(JSON.stringify({ atlasUploadId: uploadRecord.id }))
      const muxUploadId = upload.data.id as string
      await prisma.muxUpload.update({ where: { id: uploadRecord.id }, data: { muxUploadId, status: 'WAITING', rawData: JSON.stringify(upload) } })
      return NextResponse.json({ uploadId: uploadRecord.id, muxUploadId, url: upload.data.url })
    } catch (error) {
      await prisma.muxUpload.update({ where: { id: uploadRecord.id }, data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Unable to create Mux upload' } })
      return NextResponse.json({ error: 'Unable to create Mux upload' }, { status: 502 })
    }
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to create video upload'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 })
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id: courseId, lessonId } = await params
    await requireOwnedCourseEditor(courseId)
    if (!await getLesson(courseId, lessonId)) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    const record = await prisma.muxUpload.findFirst({ where: { courseId, lessonId }, orderBy: { createdAt: 'desc' } })
    if (!record) return NextResponse.json({ upload: null })

    if (['WAITING', 'PROCESSING', 'CREATING'].includes(record.status) && record.muxUploadId) {
      try {
        const mux = getMuxClient()
        if (mux) {
          const upload = await mux.getUpload(record.muxUploadId)
          const assetId = (upload.data as { asset_id?: string | null }).asset_id ?? null
          if (assetId && assetId !== record.muxAssetId) {
            await prisma.muxUpload.update({ where: { id: record.id }, data: { muxAssetId: assetId, status: 'PROCESSING' } })
            record.muxAssetId = assetId
            record.status = 'PROCESSING'
          }
          if (assetId) {
            try {
              const asset = await mux.getAsset(assetId)
              const assetData = asset.data as { status?: string; duration?: number; playback_ids?: { id: string }[]; errors?: { type?: string; messages?: string[] } }
              const playbackId = assetData.playback_ids?.find((item) => item.id)?.id ?? null
              if (assetData.status === 'ready' && playbackId) {
                await prisma.$transaction([
                  prisma.muxUpload.update({ where: { id: record.id }, data: { muxAssetId: assetId, playbackId, duration: assetData.duration ?? null, status: 'READY', errorCode: null, errorMessage: null } }),
                  prisma.lesson.update({ where: { id: lessonId }, data: { muxPlaybackId: playbackId, ...(assetData.duration ? { durationSeconds: Math.round(assetData.duration) } : {}) } }),
                ])
                const duration = await prisma.lesson.aggregate({ where: { module: { courseId } }, _sum: { durationSeconds: true } })
                const durationSeconds = duration._sum.durationSeconds ?? 0
                await prisma.course.update({ where: { id: courseId }, data: { durationSeconds, durationMinutes: Math.ceil(durationSeconds / 60) } })
                record.status = 'READY'
                record.playbackId = playbackId
                record.duration = assetData.duration ?? null
              } else if (assetData.status === 'errored') {
                await prisma.muxUpload.update({ where: { id: record.id }, data: { muxAssetId: assetId, status: 'FAILED', errorCode: assetData.errors?.type ?? null, errorMessage: assetData.errors?.messages?.join(' ') ?? 'Mux could not process this video' } })
                record.status = 'FAILED'
              }
            } catch {}
          }
        }
      } catch {}
    }

    return NextResponse.json({ upload: { id: record.id, muxUploadId: record.muxUploadId, muxAssetId: record.muxAssetId, playbackId: record.playbackId, filename: record.filename, sizeBytes: record.sizeBytes?.toString() ?? null, duration: record.duration, status: record.status, errorCode: record.errorCode, errorMessage: record.errorMessage, updatedAt: record.updatedAt } })
  } catch { return NextResponse.json({ error: 'Unable to load video upload' }, { status: 500 }) }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id: courseId, lessonId } = await params
    await requireOwnedCourseEditor(courseId)
    if (!await getLesson(courseId, lessonId)) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
    const latest = await prisma.muxUpload.findFirst({ where: { courseId, lessonId }, orderBy: { createdAt: 'desc' } })
    await prisma.$transaction([
      prisma.lesson.update({ where: { id: lessonId }, data: { muxPlaybackId: null } }),
      ...(latest ? [prisma.muxUpload.update({ where: { id: latest.id }, data: { status: 'CANCELLED', playbackId: null } })] : []),
    ])
    return NextResponse.json({ removed: true })
  } catch { return NextResponse.json({ error: 'Unable to remove lesson video' }, { status: 500 }) }
}

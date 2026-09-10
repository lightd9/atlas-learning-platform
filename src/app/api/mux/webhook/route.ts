import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMuxWebhookSignature } from '@/lib/mux'

export async function POST(request: Request) {
  const payload = await request.text()
  if (!verifyMuxWebhookSignature(payload, request.headers.get('mux-signature'))) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  try {
    const event = JSON.parse(payload) as { type?: string; id?: string; data?: { id?: string; asset_id?: string; status?: string; duration?: number; playback_ids?: { id: string }[]; passthrough?: string; errors?: { type?: string; messages?: string[] } } }
    const data = event.data ?? {}
    const playbackId = data.playback_ids?.find((item) => item.id)?.id ?? null
    let atlasUploadId: string | undefined
    if (data.passthrough) {
      try { atlasUploadId = (JSON.parse(data.passthrough) as { atlasUploadId?: string }).atlasUploadId } catch {}
    }

    if (event.type?.startsWith('video.upload.') && data.id) {
      const upload = atlasUploadId
        ? await prisma.muxUpload.findUnique({ where: { id: atlasUploadId } })
        : await prisma.muxUpload.findUnique({ where: { muxUploadId: data.id } })
      if (upload) {
        const failed = event.type === 'video.upload.errored' || event.type === 'video.upload.cancelled'
        await prisma.muxUpload.update({ where: { id: upload.id }, data: { muxUploadId: data.id, muxAssetId: data.asset_id ?? upload.muxAssetId, status: failed ? (event.type === 'video.upload.cancelled' ? 'CANCELLED' : 'FAILED') : data.asset_id ? 'PROCESSING' : 'WAITING', errorCode: data.errors?.type ?? null, errorMessage: data.errors?.messages?.join(' ') ?? null, rawData: payload } })
      }
      return NextResponse.json({ received: true })
    }

    const assetId = data.id ?? event.id
    if (!assetId) return NextResponse.json({ received: true })
    await prisma.muxAsset.upsert({ where: { id: assetId }, update: { playbackId, status: event.type ?? data.status ?? 'received', passthrough: data.passthrough ?? null, duration: data.duration ?? null, rawData: payload }, create: { id: assetId, playbackId, status: event.type ?? data.status ?? 'received', passthrough: data.passthrough ?? null, duration: data.duration ?? null, rawData: payload } })

    const upload = atlasUploadId
      ? await prisma.muxUpload.findUnique({ where: { id: atlasUploadId } })
      : await prisma.muxUpload.findUnique({ where: { muxAssetId: assetId } })

    if (upload && event.type === 'video.asset.errored') {
      await prisma.muxUpload.update({ where: { id: upload.id }, data: { muxAssetId: assetId, status: 'FAILED', errorCode: data.errors?.type ?? null, errorMessage: data.errors?.messages?.join(' ') ?? 'Mux could not process this video', rawData: payload } })
    }

    if (event.type === 'video.asset.ready' && playbackId) {
      try {
        if (upload) {
          await prisma.$transaction([
            prisma.muxUpload.update({ where: { id: upload.id }, data: { muxAssetId: assetId, playbackId, duration: data.duration ?? null, status: 'READY', errorCode: null, errorMessage: null, rawData: payload } }),
            prisma.lesson.update({ where: { id: upload.lessonId }, data: { muxPlaybackId: playbackId, ...(data.duration ? { durationSeconds: Math.round(data.duration) } : {}) } }),
          ])
        } else if (data.passthrough) {
          const target = JSON.parse(data.passthrough) as { courseId?: string; lessonId?: string }
          if (target.lessonId) await prisma.lesson.update({ where: { id: target.lessonId }, data: { muxPlaybackId: playbackId } })
          else if (target.courseId) await prisma.course.update({ where: { id: target.courseId }, data: { muxPlaybackId: playbackId } })
        }
      } catch {
        // Keep webhook acknowledgement idempotent even if passthrough metadata is malformed.
      }
    }
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }
}

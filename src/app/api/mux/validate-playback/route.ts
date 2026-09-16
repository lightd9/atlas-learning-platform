import { NextResponse } from 'next/server'
import { generatePlaybackUrl } from '@/lib/mux'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playbackId = searchParams.get('playbackId')
    if (!playbackId || typeof playbackId !== 'string') {
      return NextResponse.json({ valid: false, error: 'No playback ID provided' })
    }

    const url = await generatePlaybackUrl(playbackId)
    if (!url) {
      return NextResponse.json({ valid: false, error: 'Signing key is not configured' })
    }

    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) {
      return NextResponse.json({ valid: true })
    }

    const detail = res.status === 403
      ? 'Playback ID exists but signing key does not match the Mux dashboard configuration'
      : res.status === 404
        ? 'No Mux asset found for this playback ID'
        : `Mux returned status ${res.status}`

    return NextResponse.json({ valid: false, error: detail })
  } catch (error) {
    return NextResponse.json({ valid: false, error: `Network error: ${error instanceof Error ? error.message : 'unknown'}` })
  }
}

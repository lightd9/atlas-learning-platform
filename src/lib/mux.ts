import { createHmac, createPrivateKey, timingSafeEqual } from 'node:crypto'
import { SignJWT } from 'jose'

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET
const MUX_SIGNING_KEY_ID = process.env.MUX_SIGNING_KEY_ID
const MUX_SIGNING_KEY_PRIVATE_KEY = process.env.MUX_SIGNING_KEY_PRIVATE_KEY

export function getMuxClient() {
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) return null

  const auth = Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')
  const baseUrl = 'https://api.mux.com'

  return {
    async createAsset(uploadUrl: string) {
      const res = await fetch(`${baseUrl}/video/v1/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [{ url: uploadUrl }],
          playback_policy: ['signed'],
          mp4_support: 'standard',
        }),
      })
      if (!res.ok) throw new Error('Failed to create Mux asset')
      return await res.json()
    },

    async createDirectUpload(passthrough?: string) {
      const res = await fetch(`${baseUrl}/video/v1/uploads`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_asset_settings: {
            playback_policy: ['signed'],
            mp4_support: 'standard',
            ...(passthrough ? { passthrough } : {}),
          },
          cors_origin: [process.env.AUTH_URL, 'http://localhost:3000', 'http://localhost:5173'].filter(Boolean) as string[],
        }),
      })
      if (!res.ok) throw new Error('Failed to create direct upload')
      return await res.json()
    },

    async getAsset(assetId: string) {
      const res = await fetch(`${baseUrl}/video/v1/assets/${assetId}`, {
        headers: { 'Authorization': `Basic ${auth}` },
      })
      if (!res.ok) throw new Error('Failed to get asset')
      return await res.json()
    },

    async getUpload(uploadId: string) {
      const res = await fetch(`${baseUrl}/video/v1/uploads/${uploadId}`, {
        headers: { 'Authorization': `Basic ${auth}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to get upload')
      return await res.json()
    },

    async deleteAsset(assetId: string) {
      const res = await fetch(`${baseUrl}/video/v1/assets/${assetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Basic ${auth}` },
      })
      if (!res.ok) throw new Error('Failed to delete asset')
    },
  }
}

export async function generatePlaybackUrl(playbackId: string): Promise<string | null> {
  if (!MUX_SIGNING_KEY_ID || !MUX_SIGNING_KEY_PRIVATE_KEY) return null
  const privateKey = getSigningPrivateKey()
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: MUX_SIGNING_KEY_ID, typ: 'JWT' })
    .setSubject(playbackId)
    .setAudience('v')
    .setExpirationTime('2h')
    .sign(privateKey)
  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`
}

function getSigningPrivateKey() {
  let privateKeyValue = MUX_SIGNING_KEY_PRIVATE_KEY!.replace(/\\n/g, '\n').trim()
  if (!privateKeyValue.includes('-----BEGIN')) privateKeyValue = Buffer.from(privateKeyValue, 'base64').toString('utf8').trim()
  return createPrivateKey(privateKeyValue)
}

export function verifyMuxWebhookSignature(payload: string, signature: string | null, secret = process.env.MUX_WEBHOOK_SECRET) {
  if (!secret || !signature) return false
  const parts = Object.fromEntries(signature.split(',').map((part) => part.split('=')))
  if (!parts.t || !parts.v1) return false
  const timestamp = Number(parts.t)
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false
  const expected = createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex')
  const received = Buffer.from(parts.v1, 'hex')
  const calculated = Buffer.from(expected, 'hex')
  return received.length === calculated.length && timingSafeEqual(received, calculated)
}

export async function generateThumbnailUrl(playbackId: string): Promise<string | null> {
  if (!MUX_SIGNING_KEY_ID || !MUX_SIGNING_KEY_PRIVATE_KEY) return null
  // Course cards use a landscape frame. Ask Mux for a 16:9 thumbnail so the
  // source frame is composed for the card rather than returning a portrait
  // crop from a landscape video.
  const token = await new SignJWT({ time: 1, width: 640, aspect_ratio: '16:9', fit_mode: 'smartcrop' })
    .setProtectedHeader({ alg: 'RS256', kid: MUX_SIGNING_KEY_ID, typ: 'JWT' })
    .setSubject(playbackId)
    .setAudience('t')
    .setExpirationTime('2h')
    .sign(getSigningPrivateKey())
  return `https://image.mux.com/${playbackId}/thumbnail.webp?token=${token}`
}

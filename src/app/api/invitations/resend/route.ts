import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSchoolManager } from '@/lib/access'
import { apiErrorResponse } from '@/lib/api-errors'
import { resendInvitationBatch } from '@/lib/bulk-invitation-resend'

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500), schoolId: z.string().min(1).optional() })

export async function POST(request: Request) {
  try {
    const manager = await requireSchoolManager()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Select between 1 and 500 invitations to resend.' }, { status: 400 })
    return NextResponse.json(await resendInvitationBatch(manager, parsed.data.ids, parsed.data.schoolId))
  } catch (error) {
    return apiErrorResponse(error, 'Unable to resend invitations')
  }
}

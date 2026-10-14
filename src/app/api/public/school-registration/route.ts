import { NextResponse } from 'next/server'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { auditLog } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
})

function clientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

async function resolveSchool(token: string) {
  if (!token) return null
  return prisma.school.findUnique({
    where: { parentRegistrationToken: token },
    select: { id: true, name: true, active: true, parentRegistrationEnabled: true },
  })
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('school') ?? new URL(request.url).searchParams.get('token') ?? ''
    const school = await resolveSchool(token)
    if (!school || !school.active || !school.parentRegistrationEnabled) {
      return NextResponse.json({ valid: false })
    }
    return NextResponse.json({ valid: true, schoolName: school.name })
  } catch {
    return NextResponse.json({ valid: false })
  }
}

export async function POST(request: Request) {
  try {
    const body = registerSchema.safeParse(await request.json())
    if (!body.success) return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 })

    const school = await resolveSchool(body.data.token)
    if (!school) return NextResponse.json({ error: 'This registration link is not valid.' }, { status: 404 })
    if (!school.active || !school.parentRegistrationEnabled) {
      return NextResponse.json({ error: 'Registration for this school is currently closed.' }, { status: 403 })
    }

    if (!(await rateLimit(`parent-register:${clientIp(request)}:${school.id}`, 10, 60 * 60 * 1000)).allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
    }

    const existing = await prisma.user.findUnique({ where: { email: body.data.email }, select: { id: true } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 409 })
    }

    const passwordHash = await hash(body.data.password, 12)
    const user = await prisma.user.create({
      data: {
        email: body.data.email,
        name: body.data.name,
        passwordHash,
        role: 'PARENT',
        schoolId: school.id,
        status: 'ACTIVE',
        lastActiveAt: new Date(),
      },
      select: { id: true, email: true, name: true },
    })

    await auditLog({ action: 'PARENT.REGISTER', userId: user.id, schoolId: school.id, details: `Parent ${user.email} registered for ${school.name}` })

    return NextResponse.json({ success: true, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Unable to complete registration. Please try again.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { requireSchoolManager } from '@/lib/access'
import { prisma } from '@/lib/prisma'
import { parseCsv, normalizeCsvHeader } from '@/lib/csv'
import { z } from 'zod'

export async function POST(request: Request) {
  try {
    const manager = await requireSchoolManager()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

    const requestedSchoolId = String(formData.get('schoolId') || '')
    const schoolId = manager.role === 'ATLAS_ADMIN' ? requestedSchoolId : manager.schoolId
    if (!schoolId) return NextResponse.json({ error: 'A school is required.' }, { status: 400 })

    const rows = parseCsv((await file.text()).replace(/^\ufeff/, ''))
    if (rows.length < 2) return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    if (rows.length - 1 > 500) return NextResponse.json({ error: 'CSV cannot contain more than 500 teacher rows' }, { status: 400 })

    const header = rows[0].map(normalizeCsvHeader)
    const nameIdx = header.indexOf('name')
    const firstNameIdx = header.indexOf('firstname')
    const lastNameIdx = header.indexOf('lastname')
    const emailIdx = header.indexOf('email')

    if (emailIdx === -1 || (nameIdx === -1 && firstNameIdx === -1)) {
      return NextResponse.json({
        error: 'CSV must have "name" and "email" columns, or "firstName", "lastName" and "email" columns',
        columnsFound: header,
      }, { status: 400 })
    }

    type RowResult = { row: number; name: string; email: string; valid: boolean; error?: string }
    const results: RowResult[] = []

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i]
      const name = nameIdx !== -1
        ? cols[nameIdx] || ''
        : `${cols[firstNameIdx] || ''} ${lastNameIdx !== -1 ? cols[lastNameIdx] || '' : ''}`.trim()
      const emailResult = z.string().trim().email().safeParse(cols[emailIdx] || '')
      const email = emailResult.success ? emailResult.data.toLowerCase() : (cols[emailIdx] || '').trim().toLowerCase()

      if (!name) { results.push({ row: i + 1, name: '', email, valid: false, error: 'Missing name' }); continue }
      if (!emailResult.success) { results.push({ row: i + 1, name, email, valid: false, error: 'Invalid email' }); continue }

      results.push({ row: i + 1, name, email, valid: true })
    }

    const validRows = results.filter((r) => r.valid)
    const invalidRows = results.filter((r) => !r.valid)

    // Check for duplicates within CSV
    const csvEmails = validRows.map((r) => r.email)
    const duplicateEmails = csvEmails.filter((e, idx) => csvEmails.indexOf(e) !== idx)
    if (duplicateEmails.length > 0) {
      return NextResponse.json({
        error: `Duplicate emails found in CSV: ${[...new Set(duplicateEmails)].join(', ')}`,
        results,
      }, { status: 409 })
    }

    // Check for existing active users
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: csvEmails }, status: 'ACTIVE' },
      select: { email: true },
    })
    const existingActiveEmails = new Set(existingUsers.map((u) => u.email))

    // Check for pending invitations
    const existingInvitations = await prisma.invitation.findMany({
      where: { email: { in: csvEmails }, status: 'PENDING' },
      select: { email: true },
    })
    const pendingEmails = new Set(existingInvitations.map((i) => i.email))

    const canImport = validRows.filter((r) => !existingActiveEmails.has(r.email) && !pendingEmails.has(r.email))

    return NextResponse.json({
      totalRows: results.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      alreadyActive: existingActiveEmails.size,
      alreadyPending: pendingEmails.size,
      canImport: canImport.length,
      results,
      existingActive: [...existingActiveEmails],
      existingPending: [...pendingEmails],
    })
  } catch (error) {
    return NextResponse.json({ error: 'Unable to process CSV' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export async function GET() {
  const csv = '\ufeffname,email\n'
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="teacher-invitation-template.csv"',
    },
  })
}

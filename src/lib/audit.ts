import { prisma } from '@/lib/prisma'

export type AuditAction =
  | 'USER.LOGIN'
  | 'USER.LOGOUT'
  | 'USER.SETUP'
  | 'USER.DISABLED'
  | 'USER.ENABLED'
  | 'USER.PROFILE_UPDATE'
  | 'INVITATION.CREATE'
  | 'INVITATION.RESEND'
  | 'INVITATION.REVOKE'
  | 'INVITATION.ACCEPT'
  | 'COURSE.CREATE'
  | 'COURSE.UPDATE'
  | 'COURSE.DELETE'
  | 'COURSE.ARCHIVE'
  | 'SCHOOL.CREATE'
  | 'SCHOOL.UPDATE'
  | 'PROGRESS.UPDATE'
  | 'PROGRESS.COMPLETE'
  | 'CSV.IMPORT'
  | 'ADMIN.ACTION'
  | 'INVITATION.RESEND_REQUEST'

export async function auditLog(params: {
  action: AuditAction
  userId?: string
  schoolId?: string
  details?: string
}) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUDIT] ${params.action} | user:${params.userId ?? 'anon'} | school:${params.schoolId ?? 'none'} | ${params.details ?? ''}`)
    }
    await prisma.auditLog.create({ data: params })
  } catch {
    // Fail silently
  }
}

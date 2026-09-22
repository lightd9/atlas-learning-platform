import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function requireSchoolUser() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Error('UNAUTHORIZED')

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.status === 'DISABLED') throw new Error('FORBIDDEN')
  return user
}

export async function requireSchoolManager() {
  const user = await requireSchoolUser()
  if (user.role !== 'HEADTEACHER' && user.role !== 'ATLAS_ADMIN') throw new Error('FORBIDDEN')
  return user
}

export async function requireHeadteacher() {
  const user = await requireSchoolUser()
  if (user.role !== 'HEADTEACHER') throw new Error('FORBIDDEN')
  return user
}

export async function requireAtlasAdmin() {
  const user = await requireSchoolUser()
  if (user.role !== 'ATLAS_ADMIN') throw new Error('FORBIDDEN')
  return user
}

export async function requireAtlasEmployee() {
  const user = await requireSchoolUser()
  if (user.role !== 'ATLAS_ADMIN' && user.role !== 'ATLAS_EMPLOYEE') throw new Error('FORBIDDEN')
  return user
}

export const USER_RESET_PASSWORD = 'USER_RESET_PASSWORD'
export async function requireUserPasswordResetAccess() {
  const user = await requireAtlasEmployee()
  if (user.role !== 'ATLAS_ADMIN' && !(Array.isArray(user.permissions) && user.permissions.includes(USER_RESET_PASSWORD))) throw new Error('FORBIDDEN')
  return user
}

export async function requireCourseEditor() {
  const user = await requireSchoolUser()
  if (user.role !== 'ATLAS_ADMIN' && user.role !== 'ATLAS_EMPLOYEE' && user.role !== 'INSTRUCTOR') throw new Error('FORBIDDEN')
  return user
}

export const INSTRUCTOR_PERMISSIONS = ['COURSE_CREATE', 'COURSE_EDIT_OWN', 'COURSE_EDIT_ALL', 'COURSE_PUBLISH', 'COURSE_DELETE', 'SCHOOL_ASSIGN', 'ANALYTICS_VIEW', 'HOME_CONTENT_MANAGE', 'SCHOOL_CREATE', 'USER_CREATE', 'USER_RESET_PASSWORD', 'USER_DELETE', 'AUDIT_VIEW'] as const
export type InstructorPermission = typeof INSTRUCTOR_PERMISSIONS[number]
export function hasPermission(user: { role: string; permissions?: unknown }, permission: InstructorPermission) {
  if (user.role === 'ATLAS_ADMIN') return true
  if (user.role === 'ATLAS_EMPLOYEE' && ['COURSE_CREATE', 'COURSE_EDIT_OWN', 'COURSE_EDIT_ALL', 'COURSE_PUBLISH', 'SCHOOL_ASSIGN', 'ANALYTICS_VIEW'].includes(permission)) return true
  return user.role === 'ATLAS_EMPLOYEE' && Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export async function requireHomeContentManager() {
  const user = await requireSchoolUser()
  if (!hasPermission(user, 'HOME_CONTENT_MANAGE')) throw new Error('FORBIDDEN')
  return user
}

export async function requirePermission(permission: InstructorPermission) {
  const user = await requireSchoolUser()
  if (!hasPermission(user, permission)) throw new Error('FORBIDDEN')
  return user
}

export async function requireUsersViewer() {
  const user = await requireSchoolUser()
  if (!hasPermission(user, 'USER_CREATE') && !hasPermission(user, 'USER_RESET_PASSWORD')) throw new Error('FORBIDDEN')
  return user
}

export async function requireOwnedCourseEditor(courseId: string) {
  const user = await requireCourseEditor()
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { createdById: true } })
  if (!course) throw new Error('COURSE_NOT_FOUND')
  if (user.role === 'INSTRUCTOR' && course.createdById !== user.id && !hasPermission(user, 'COURSE_EDIT_ALL')) throw new Error('FORBIDDEN')
  return user
}

export async function requireAvailableCourse(user: { schoolId: string | null }, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      published: true,
      schoolAccess: user.schoolId ? { where: { schoolId: user.schoolId }, select: { enabled: true } } : false,
    },
  })
  if (!course) throw new Error('COURSE_NOT_FOUND')
  if (!course.published) throw new Error('FORBIDDEN')
  if (user.schoolId && course.schoolAccess[0]?.enabled === false) throw new Error('FORBIDDEN')
  return course
}

export type LearnerUser = {
  role: string
  schoolId: string | null | undefined
}

export type CourseAccessShape = {
  audience: 'STAFF' | 'PARENT'
  published: boolean
  status?: string | null
  schoolAccessEnabled?: boolean | null
}

export function isStaffRole(role: string): boolean {
  return ['TEACHER', 'HEADTEACHER', 'INSTRUCTOR', 'ATLAS_EMPLOYEE', 'ATLAS_ADMIN'].includes(role)
}

export function canLearnerAccessCourse(user: LearnerUser, course: CourseAccessShape): boolean {
  if (!course.published || course.status !== 'PUBLISHED') return false

  if (!isStaffRole(user.role) && user.role !== 'PARENT') return false
  if (user.role === 'PARENT' && course.audience !== 'PARENT') return false
  return course.schoolAccessEnabled !== false
}

export function buildLearnerCourseWhere(user: LearnerUser) {
  const schoolId = user.schoolId ?? ''
  const schoolDefault = {
    OR: [
      { schoolAccess: { none: { schoolId } } },
      { schoolAccess: { some: { schoolId, enabled: true } } },
    ],
  }

  if (!isStaffRole(user.role)) {
    return { published: true, status: 'PUBLISHED' as const, audience: 'PARENT' as const, ...schoolDefault }
  }

  return { published: true, status: 'PUBLISHED' as const, ...schoolDefault }
}

import { describe, it, expect } from 'vitest'
import { buildLearnerCourseWhere, canLearnerAccessCourse, isStaffRole } from '@/lib/course-access-policy'

type Course = {
  audience: 'STAFF' | 'PARENT'
  published: boolean
  status?: string
  schoolAccessEnabled?: boolean | null
}

function course(overrides: Partial<Course> = {}): Course {
  return { audience: 'STAFF', published: true, status: 'PUBLISHED', ...overrides }
}

describe('isStaffRole', () => {
  it('treats every non-parent Atlas role as staff', () => {
    expect(isStaffRole('TEACHER')).toBe(true)
    expect(isStaffRole('HEADTEACHER')).toBe(true)
    expect(isStaffRole('INSTRUCTOR')).toBe(true)
    expect(isStaffRole('ATLAS_EMPLOYEE')).toBe(true)
    expect(isStaffRole('ATLAS_ADMIN')).toBe(true)
    expect(isStaffRole('PARENT')).toBe(false)
  })
})

describe('canLearnerAccessCourse', () => {
  it('allows staff to watch a staff course by default', () => {
    expect(canLearnerAccessCourse({ role: 'TEACHER', schoolId: 'school-1' }, course())).toBe(true)
  })

  it('allows parents to watch a parent course', () => {
    expect(canLearnerAccessCourse({ role: 'PARENT', schoolId: 'school-1' }, course({ audience: 'PARENT' }))).toBe(true)
  })

  it('allows staff to watch a parent course with an explicit enabled row', () => {
    expect(canLearnerAccessCourse(
      { role: 'TEACHER', schoolId: 'school-1' },
      course({ audience: 'PARENT', schoolAccessEnabled: true }),
    )).toBe(true)
  })

  it('allows parent courses for staff by default and respects a school restriction', () => {
    expect(canLearnerAccessCourse(
      { role: 'TEACHER', schoolId: 'school-1' },
      course({ audience: 'PARENT', schoolAccessEnabled: undefined }),
    )).toBe(true)
    expect(canLearnerAccessCourse(
      { role: 'TEACHER', schoolId: 'school-1' },
      course({ audience: 'PARENT', schoolAccessEnabled: false }),
    )).toBe(false)
  })

  it('never allows parents to watch staff courses, even with an enabled row', () => {
    expect(canLearnerAccessCourse(
      { role: 'PARENT', schoolId: 'school-1' },
      course({ audience: 'STAFF', schoolAccessEnabled: true }),
    )).toBe(false)
  })

  it('denies unpublished and non-published-status courses', () => {
    expect(canLearnerAccessCourse({ role: 'TEACHER', schoolId: 'school-1' }, course({ published: false }))).toBe(false)
    expect(canLearnerAccessCourse({ role: 'TEACHER', schoolId: 'school-1' }, course({ status: 'DRAFT' }))).toBe(false)
  })
})

describe('buildLearnerCourseWhere', () => {
  it('includes both audiences by default for staff and keeps school restrictions', () => {
    expect(buildLearnerCourseWhere({ role: 'TEACHER', schoolId: 'school-1' })).toEqual({
      published: true,
      status: 'PUBLISHED',
      OR: [
        { schoolAccess: { none: { schoolId: 'school-1' } } },
        { schoolAccess: { some: { schoolId: 'school-1', enabled: true } } },
      ],
    })
  })

  it('allows headteachers to take parent courses and denies unknown roles', () => {
    expect(canLearnerAccessCourse({ role: 'HEADTEACHER', schoolId: 'school-1' }, course({ audience: 'PARENT' }))).toBe(true)
    expect(canLearnerAccessCourse({ role: 'UNKNOWN', schoolId: 'school-1' }, course())).toBe(false)
  })

  it('only returns parent courses for parents', () => {
    expect(buildLearnerCourseWhere({ role: 'PARENT', schoolId: 'school-1' })).toEqual({
      published: true,
      status: 'PUBLISHED',
      audience: 'PARENT',
      OR: [
        { schoolAccess: { none: { schoolId: 'school-1' } } },
        { schoolAccess: { some: { schoolId: 'school-1', enabled: true } } },
      ],
    })
  })
})

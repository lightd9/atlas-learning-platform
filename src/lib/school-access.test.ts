import { describe, it, expect } from 'vitest'
import { planCourseSchoolSelection, planSchoolCourseSelection } from '@/lib/school-access'

describe('planSchoolCourseSelection', () => {
  const courses = [
    { id: 'staff-1', audience: 'STAFF' as const },
    { id: 'parent-1', audience: 'PARENT' as const },
  ]

  it('restores the global default for both audiences when everything is selected', () => {
    const plan = planSchoolCourseSelection({
      schoolId: 'school-1',
      courses,
      selectedCourseIds: ['staff-1', 'parent-1'],
    })
    expect(plan.deletes).toEqual([{ schoolId: 'school-1', courseId: 'staff-1' }, { schoolId: 'school-1', courseId: 'parent-1' }])
    expect(plan.upserts).toEqual([])
  })

  it('writes restrictions for unselected courses and restores selected course defaults', () => {
    const plan = planSchoolCourseSelection({
      schoolId: 'school-1',
      courses,
      selectedCourseIds: ['parent-1'],
    })
    expect(plan.deletes).toEqual([{ schoolId: 'school-1', courseId: 'parent-1' }])
    expect(plan.upserts).toEqual([
      { schoolId: 'school-1', courseId: 'staff-1', enabled: false },
    ])
  })
})

describe('planCourseSchoolSelection', () => {
  it('restores the global default for parent courses when all schools are selected', () => {
    const plan = planCourseSchoolSelection({
      courseId: 'parent-1',
      courseAudience: 'PARENT',
      schools: [{ id: 'school-1' }, { id: 'school-2' }],
      selectedSchoolIds: ['school-1', 'school-2'],
    })
    expect(plan.deletes).toEqual([{ schoolId: 'school-1', courseId: 'parent-1' }, { schoolId: 'school-2', courseId: 'parent-1' }])
    expect(plan.upserts).toEqual([])
  })

  it('restores the global default for a staff course when all schools are selected', () => {
    const plan = planCourseSchoolSelection({
      courseId: 'staff-1',
      courseAudience: 'STAFF',
      schools: [{ id: 'school-1' }, { id: 'school-2' }],
      selectedSchoolIds: ['school-1', 'school-2'],
    })
    expect(plan.deletes).toEqual([
      { schoolId: 'school-1', courseId: 'staff-1' },
      { schoolId: 'school-2', courseId: 'staff-1' },
    ])
    expect(plan.upserts).toEqual([])
  })
})

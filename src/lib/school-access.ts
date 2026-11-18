export type SelectionCourse = { id: string; audience: 'STAFF' | 'PARENT' }
export type SchoolRef = { id: string }

export type SchoolCourseKey = { schoolId: string; courseId: string }
export type SchoolCourseUpsert = SchoolCourseKey & { enabled: boolean }

export function planSchoolCourseSelection({
  schoolId,
  courses,
  selectedCourseIds,
}: {
  schoolId: string
  courses: SelectionCourse[]
  selectedCourseIds: string[]
}) {
  const selected = new Set(selectedCourseIds)
  const deletes: SchoolCourseKey[] = []
  const upserts: SchoolCourseUpsert[] = []

  for (const course of courses) {
    const key = { schoolId, courseId: course.id }
    if (!selected.has(course.id)) {
      upserts.push({ ...key, enabled: false })
    } else {
      deletes.push(key)
    }
  }

  return { deletes, upserts }
}

export function planCourseSchoolSelection({
  courseId,
  courseAudience,
  schools,
  selectedSchoolIds,
}: {
  courseId: string
  courseAudience: 'STAFF' | 'PARENT'
  schools: SchoolRef[]
  selectedSchoolIds: string[]
}) {
  const selected = new Set(selectedSchoolIds)
  const allSelected = schools.every((school) => selected.has(school.id))
  const deletes: SchoolCourseKey[] = []
  const upserts: SchoolCourseUpsert[] = []

  for (const school of schools) {
    const key = { schoolId: school.id, courseId }
    if (allSelected) {
      deletes.push(key)
    } else if (selected.has(school.id)) {
      upserts.push({ ...key, enabled: true })
    } else {
      upserts.push({ ...key, enabled: false })
    }
  }

  return { deletes, upserts }
}

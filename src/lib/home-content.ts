export const HOME_SECTION_LIMITS = {
  RECOMMENDED: 8,
  TOP_COURSES: null,
  UNLOCK_SOMETHING_NEW: 12,
  EXPLORE: null,
} as const satisfies Record<string, number | null>

export type HomeSection = keyof typeof HOME_SECTION_LIMITS

export const HOME_SECTIONS = Object.keys(HOME_SECTION_LIMITS) as HomeSection[]

type HomeCourseEligibility = {
  published?: boolean
  status?: string
  audience?: string
}

type PublicCourseShape = HomeCourseEligibility & {
  [key: string]: unknown
}

type PlacementShape = {
  id: string
  section: string
  sortOrder: number
  course: PublicCourseShape
  [key: string]: unknown
}

type PlacementWithCourse = {
  active?: boolean
  course?: HomeCourseEligibility | null
}

export function isPublicHomeCourse(course?: HomeCourseEligibility | null): boolean {
  return course?.published === true && course.status === 'PUBLISHED' && (course.audience === 'STAFF' || course.audience === 'PARENT')
}

export function getVisibleHomePlacements<T extends PlacementWithCourse>(placements: T[]): T[] {
  return placements.filter((placement) => isPublicHomeCourse(placement.course))
}

export function countActiveHomePlacements<T extends PlacementWithCourse>(placements: T[]): number {
  return getVisibleHomePlacements(placements).filter((placement) => placement.active === true).length
}

export function canActivateHomePlacement({
  section,
  active,
  existingActive,
  activeCount,
}: {
  section: HomeSection
  active: boolean
  existingActive: boolean | undefined
  activeCount: number
}): boolean {
  if (!active) return true
  const limit = HOME_SECTION_LIMITS[section]
  if (limit === null || existingActive === true) return true
  return activeCount < limit
}

export function serializeHomeContent(placements: PlacementShape[]) {
  const grouped: Record<string, Array<Record<string, unknown>>> = {}
  for (const section of HOME_SECTIONS) grouped[section] = []

  for (const placement of placements) {
    if (!grouped[placement.section] || !isPublicHomeCourse(placement.course)) continue
    const { muxPlaybackId: _playbackId, ...course } = placement.course
    grouped[placement.section].push({
      ...course,
      placementId: placement.id,
      sortOrder: placement.sortOrder,
    })
  }

  for (const [section, limit] of Object.entries(HOME_SECTION_LIMITS)) {
    if (limit !== null) grouped[section] = grouped[section].slice(0, limit)
  }

  return grouped
}

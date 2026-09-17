export interface ApiCourse {
  id: string
  slug: string
  title: string
  description: string
  durationMinutes: number
  durationSeconds?: number
  published: boolean
  muxPlaybackId?: string | null
  section?: ApiCourseSection | null
  modules?: ApiCourseModule[]
  notes?: string | null
  resources?: ApiCourseResource[]
  progress?: {
    id: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
    watchedSeconds: number
    durationSeconds: number
    percentComplete: number
    lastWatchedAt: string | null
  }[]
}

export interface ApiCourseResource {
  id: string
  title: string
  description?: string | null
  url: string
  fileName?: string | null
  sortOrder: number
}

export interface ApiCourseModule {
  id: string
  title: string
  description?: string | null
  sortOrder: number
  lessons: ApiLesson[]
}

export interface ApiLesson {
  id: string
  title: string
  description?: string | null
  durationSeconds: number
  muxPlaybackId?: string | null
  sortOrder: number
  published: boolean
  progress?: {
    id: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
    watchedSeconds: number
    durationSeconds: number
    percentComplete: number
    lastWatchedAt: string | null
  }[]
}

export interface ApiCourseSection {
  id: string
  name: string
  slug: string
  description?: string | null
  sortOrder: number
}

export interface CourseCardCourse {
  id: string
  title: string
  label: string
  duration: string
  lessons: string
  tone: string
  progress: number
  description: string
}

export interface ApiTeacher {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastActiveAt: string | null
  averageProgress: number
}

export interface ApiAnalytics {
  activeTeachers: number
  totalTeachers: number
  pendingTeachers: number
  coursesCompleted: number
  totalLearningMinutes: number
  averageProgress: number
  teacherActivity: {
    name: string
    progress: string
    status: string
    lastActive: string
    initials: string
  }[]
  courseBreakdown: {
    title: string
    percent: number
    tone: string
  }[]
  learningActivity: {
    label: string
    minutes: number
  }[]
}

export interface AdminSchool {
  id: string
  name: string
  slug: string
  active: boolean
  userCount: number
  courseCount: number
  createdAt: string
}

export interface AdminCourse {
  id: string
  slug: string
  title: string
  description: string
  durationMinutes: number
  durationSeconds?: number
  published: boolean
  muxPlaybackId: string | null
  sectionId: string | null
  section: ApiCourseSection | null
  schoolAccessCount: number
  progressCount: number
  createdAt: string
  createdById?: string | null
  moduleCount?: number
  schoolAccess?: { schoolId: string; school: { id: string; name: string }; enabled: boolean }[]
  notes?: string | null
  resources?: ApiCourseResource[]
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  schoolName: string | null
  lastActiveAt: string | null
  createdAt: string
}

export interface AdminAnalytics {
  totalSchools: number
  totalTeachers: number
  totalHeadteachers: number
  totalCourses: number
  totalCompletions: number
  totalLearningMinutes: number
  activeInvitations: number
  schoolBreakdown: {
    schoolName: string
    teacherCount: number
    completionCount: number
    avgProgress: number
  }[]
}

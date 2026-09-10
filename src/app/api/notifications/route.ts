import { NextResponse } from 'next/server'
import { requireSchoolUser } from '@/lib/access'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const user = await requireSchoolUser()
    const notifications: { id: string; title: string; body: string; href: string; tone: 'blue' | 'orange' | 'green' }[] = []
    if (user.role === 'ATLAS_ADMIN') {
      const [pendingInvitations, draftCourses, incompleteCourses] = await Promise.all([
        prisma.invitation.count({ where: { status: 'PENDING' } }),
        prisma.course.count({ where: { published: false } }),
        prisma.course.count({ where: { OR: [{ modules: { none: {} } }, { modules: { some: { lessons: { none: {} } } } }] } }),
      ])
      if (pendingInvitations > 0) notifications.push({ id: 'admin-invitations', title: 'Pending invitations', body: `${pendingInvitations} invitation${pendingInvitations === 1 ? '' : 's'} need attention.`, href: '/admin/users', tone: 'orange' })
      if (draftCourses > 0) notifications.push({ id: 'admin-drafts', title: 'Courses in draft', body: `${draftCourses} course${draftCourses === 1 ? ' is' : 's are'} not published yet.`, href: '/admin/courses', tone: 'blue' })
      if (incompleteCourses > 0) notifications.push({ id: 'admin-content', title: 'Content needs review', body: `${incompleteCourses} course${incompleteCourses === 1 ? ' has' : 's have'} missing modules or lessons.`, href: '/admin/courses', tone: 'orange' })
    } else if (user.role === 'HEADTEACHER' && user.schoolId) {
      const pending = await prisma.invitation.count({ where: { schoolId: user.schoolId, status: 'PENDING' } })
      if (pending > 0) notifications.push({ id: 'school-invitations', title: 'Teacher invitations', body: `${pending} teacher invitation${pending === 1 ? '' : 's'} are awaiting setup.`, href: '/school/teachers', tone: 'orange' })
    } else if (user.role === 'TEACHER') {
      const inProgress = await prisma.courseProgress.count({ where: { userId: user.id, status: 'IN_PROGRESS' } })
      if (inProgress > 0) notifications.push({ id: 'learning-progress', title: 'Keep learning', body: `You have ${inProgress} course${inProgress === 1 ? '' : 's'} in progress.`, href: '/courses', tone: 'green' })
    }
    return NextResponse.json({ notifications })
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNAUTHORIZED' ? 'Unauthorized' : 'Unable to load notifications'
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 403 })
  }
}

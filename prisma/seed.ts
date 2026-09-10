import 'dotenv/config'
import { hash } from 'bcryptjs'
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const school = await prisma.school.upsert({ where: { slug: 'oakfield-primary' }, update: {}, create: { name: 'Oakfield Primary', slug: 'oakfield-primary' } })
  const passwordHash = await hash('AtlasDemo123!', 12)
  await prisma.user.upsert({ where: { email: 'admin@atlas-learning.test' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'admin@atlas-learning.test', name: 'Atlas Admin', passwordHash, role: UserRole.ATLAS_ADMIN, status: UserStatus.ACTIVE } })
  await prisma.user.upsert({ where: { email: 'instructor@atlas-learning.test' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'instructor@atlas-learning.test', name: 'Atlas Instructor', passwordHash, role: UserRole.INSTRUCTOR, status: UserStatus.ACTIVE } })
  const headteacher = await prisma.user.upsert({ where: { email: 'headteacher@oakfield-primary.test' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'headteacher@oakfield-primary.test', name: 'Amina Morgan', schoolId: school.id, passwordHash, role: UserRole.HEADTEACHER, status: UserStatus.ACTIVE } })
  const teacher = await prisma.user.upsert({ where: { email: 'teacher@oakfield-primary.test' }, update: { passwordHash, status: UserStatus.ACTIVE }, create: { email: 'teacher@oakfield-primary.test', name: 'James Wilson', schoolId: school.id, passwordHash, role: UserRole.TEACHER, status: UserStatus.ACTIVE } })

  const courseData = [
    ['introduction-to-ai', 'Introduction to Artificial Intelligence', 'A clear, practical introduction to AI and what it means for modern schools.', 20],
    ['ai-safety', 'AI Safety & Responsible Use in Schools', 'Build safe, thoughtful habits for using AI around pupils, data and school information.', 25],
    ['practical-ai', 'Practical AI for Education', 'Explore realistic ways AI can support lesson planning and reduce admin workload.', 30],
  ] as const
  const sections = await Promise.all([
    prisma.courseSection.upsert({ where: { slug: 'ai-technology' }, update: {}, create: { name: 'AI & technology', slug: 'ai-technology', description: 'Build confident, safe digital skills for modern schools.', sortOrder: 1 } }),
    prisma.courseSection.upsert({ where: { slug: 'safeguarding' }, update: {}, create: { name: 'Safeguarding', slug: 'safeguarding', description: 'Practical guidance for protecting pupils and school information.', sortOrder: 2 } }),
  ])
  for (const [index, [slug, title, description, durationMinutes]] of courseData.entries()) await prisma.course.upsert({ where: { slug }, update: { sectionId: sections[index === 1 ? 1 : 0].id }, create: { slug, title, description, durationMinutes, sectionId: sections[index === 1 ? 1 : 0].id } })
  const seededCourses = await prisma.course.findMany({ where: { slug: { in: courseData.map(([slug]) => slug) } }, include: { modules: true } })
  for (const course of seededCourses) {
    if (course.modules.length === 0) {
      const module = await prisma.courseModule.create({ data: { courseId: course.id, title: 'Getting started', description: 'The essential ideas and practical context for this course.', sortOrder: 0 } })
      await prisma.lesson.createMany({ data: [
        { moduleId: module.id, title: 'Introduction and overview', description: 'Understand what this course covers and why it matters.', durationSeconds: Math.max(300, Math.floor(course.durationMinutes * 60 * 0.35)), sortOrder: 0 },
        { moduleId: module.id, title: 'Core concepts', description: 'Work through the key ideas with examples for school teams.', durationSeconds: Math.max(300, Math.floor(course.durationMinutes * 60 * 0.65)), sortOrder: 1 },
      ] })
    }
  }
  const intro = await prisma.course.findUniqueOrThrow({ where: { slug: 'introduction-to-ai' } })
  await prisma.courseProgress.upsert({ where: { userId_courseId: { userId: teacher.id, courseId: intro.id } }, update: { watchedSeconds: 864, durationSeconds: 1200, percentComplete: 72, status: 'IN_PROGRESS', lastWatchedAt: new Date() }, create: { userId: teacher.id, courseId: intro.id, watchedSeconds: 864, durationSeconds: 1200, percentComplete: 72, status: 'IN_PROGRESS', lastWatchedAt: new Date() } })
  console.log('Seeded Oakfield Primary')
  console.log(`Headteacher: ${headteacher.email}`)
  console.log(`Teacher: ${teacher.email}`)
  console.log('Demo password: AtlasDemo123!')
}

main().catch((error) => { console.error(error); process.exit(1) }).finally(() => prisma.$disconnect())

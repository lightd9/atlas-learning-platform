import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials)
      if (!parsed.success) return null

      const loginKey = `login:${parsed.data.email.toLowerCase()}`
      if (!(await rateLimit(loginKey, 10, 15 * 60 * 1000)).allowed) return null

      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.trim().toLowerCase() },
      })
      if (!user?.passwordHash || user.status === 'DISABLED') return null
      if (!await compare(parsed.data.password, user.passwordHash)) return null

      await resetRateLimit(loginKey)

      return { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId, permissions: user.permissions }
    },
  })],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role
        token.schoolId = user.schoolId
        token.name = user.name
        token.email = user.email
        token.permissions = user.permissions
      }
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name ?? token.name
        token.email = session.user.email ?? token.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.role = token.role
        session.user.schoolId = token.schoolId
        session.user.name = token.name ?? session.user.name
        session.user.email = token.email ?? session.user.email
        session.user.permissions = token.permissions
      }
      return session
    },
  },
})

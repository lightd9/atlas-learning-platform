import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { encode as defaultJwtEncode, decode as defaultJwtDecode } from 'next-auth/jwt'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { sessionMaxAge } from '@/lib/session'

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  remember: z.enum(['true', 'false']).optional(),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  jwt: {
    async encode(params) {
      const maxAge = sessionMaxAge((params.token as { remember?: boolean } | undefined)?.remember, params.maxAge)
      return defaultJwtEncode({ ...params, maxAge })
    },
    async decode(params) {
      return defaultJwtDecode(params)
    },
  },
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
      await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })

      const remember = parsed.data.remember === 'true'

      return { id: user.id, email: user.email, name: user.name, role: user.role, schoolId: user.schoolId, permissions: user.permissions, mustChangePassword: user.mustChangePassword, remember }
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
        token.mustChangePassword = user.mustChangePassword
        token.remember = (user as { remember?: boolean }).remember ?? true
      }
      if (trigger === 'update' && session?.user) {
        token.name = session.user.name ?? token.name
        token.email = session.user.email ?? token.email
      }
      if (token.sub) {
        const current = await prisma.user.findUnique({ where: { id: token.sub }, select: { mustChangePassword: true } })
        token.mustChangePassword = current?.mustChangePassword ?? false
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
        session.user.mustChangePassword = token.mustChangePassword ?? false
      }
      return session
    },
  },
})

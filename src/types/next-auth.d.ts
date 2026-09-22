import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role?: string
    schoolId?: string | null
    permissions?: unknown
    mustChangePassword?: boolean
    remember?: boolean
  }
  interface Session {
    user: User & { id: string; role?: string; schoolId?: string | null }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    schoolId?: string | null
    permissions?: unknown
    mustChangePassword?: boolean
    remember?: boolean
  }
}

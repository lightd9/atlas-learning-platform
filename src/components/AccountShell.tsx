'use client'

import { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import AuthShell from '@/components/AuthShell'
import AdminShell from '@/components/AdminShell'

export default function AccountShell({ children, active }: { children: ReactNode; active: 'settings' | 'help' }) {
  const { data: session } = useSession()
  if (session?.user?.role === 'ATLAS_ADMIN') return <AdminShell active="">{children}</AdminShell>
  return <AuthShell active={active === 'settings' ? 'Settings' : 'Help centre'}>{children}</AuthShell>
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  BarChart3, BookOpen, ChevronRight, Home, LogOut,
  Menu, Search, Settings, ShieldCheck, Users, X, Shield,
} from 'lucide-react'
import Logo from '@/components/Logo'
import NotificationBell from '@/components/NotificationBell'

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('')
}

export default function AuthShell({ children, active }: { children: ReactNode; active: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()
  const user = session?.user
  const isHeadteacher = user?.role === 'HEADTEACHER'
  const isAtlasAdmin = user?.role === 'ATLAS_ADMIN'
  const isInstructor = user?.role === 'INSTRUCTOR'
  const initials = user?.name ? getInitials(user.name) : '??'
  const [schoolName, setSchoolName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/school').then((r) => r.json()).then((d) => setSchoolName(d.schoolName)).catch(() => {})
  }, [])

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
      <Logo />
      <div className="top-search"><Search size={17} /><input placeholder="Search courses" aria-label="Search courses" /></div>
      <nav className="top-nav">
        <Link href="/courses">Explore <ChevronRight size={14} /></Link>
        {isHeadteacher && <Link href="/school/analytics">Analysis</Link>}
        {(isAtlasAdmin || isInstructor) && <Link href="/admin/courses">Course studio</Link>}
        <button>Support</button>
      </nav>
      <div className="top-actions">
        <span className="school-name">{schoolName || 'Atlas Learning'}</span>
        <NotificationBell />
        <div className="avatar">{initials}</div>
        <span className="user-name">{user?.name || 'Loading...'}<small>{user?.role === 'HEADTEACHER' ? 'Headteacher' : user?.role === 'ATLAS_ADMIN' ? 'Atlas Admin' : user?.role === 'INSTRUCTOR' ? 'Instructor' : 'Teacher'}</small></span>
      </div>
    </header>
    <div className="body-layout">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-button close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <div className="side-label">Workspace</div>
        {isInstructor ? <>
          <Link href="/admin" className={`side-item ${pathname === '/admin' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Home size={18} /><span>Overview</span>{pathname === '/admin' && <span className="active-pill" />}
          </Link>
          <Link href="/admin/courses" className={`side-item ${pathname.startsWith('/admin/courses') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Shield size={18} /><span>Course management</span>{pathname.startsWith('/admin/courses') && <span className="active-pill" />}
          </Link>
        </> : <>
          <Link href="/dashboard" className={`side-item ${pathname === '/dashboard' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <Home size={18} /><span>Overview</span>{pathname === '/dashboard' && <span className="active-pill" />}
          </Link>
          <Link href="/courses" className={`side-item ${pathname.startsWith('/courses') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <BookOpen size={18} /><span>My learning</span>{pathname.startsWith('/courses') && <span className="active-pill" />}
          </Link>
        </>}
        {isHeadteacher && <Link href="/school/analytics" className={`side-item ${pathname === '/school/analytics' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <BarChart3 size={18} /><span>School analytics</span>{pathname === '/school/analytics' && <span className="active-pill" />}
        </Link>}
        {isHeadteacher && <Link href="/school/teachers" className={`side-item ${pathname === '/school/teachers' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Users size={18} /><span>Manage teachers</span>{pathname === '/school/teachers' && <span className="active-pill" />}
        </Link>}
        <div className="side-divider" />
        <div className="side-label">Account</div>
        <Link href="/settings" className={`side-item ${pathname === '/settings' ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
          <Settings size={18} /><span>Settings</span>{pathname === '/settings' && <span className="active-pill" />}
        </Link>
        <div className="sidebar-bottom">
          <Link href="/help" className="support-card" onClick={() => setSidebarOpen(false)}><ShieldCheck size={20} /><div><strong>Need a hand?</strong><span>Atlas Support is here</span></div><ChevronRight size={16} /></Link>
          <button className="logout" onClick={() => signOut({ callbackUrl: '/login' })}><LogOut size={17} /> Sign out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  </div>
}

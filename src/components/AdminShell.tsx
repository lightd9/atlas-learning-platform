'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import {
  BarChart3, BookOpen, Building2, ClipboardList, Home, LogOut, Menu, Search, Settings, ShieldCheck, Users, X, ChevronRight,
} from 'lucide-react'
import Logo from '@/components/Logo'
import NotificationBell from '@/components/NotificationBell'

function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('')
}

export default function AdminShell({ children, active }: { children: ReactNode; active: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAtlasAdmin = session?.user?.role === 'ATLAS_ADMIN'
  const isInstructor = session?.user?.role === 'INSTRUCTOR'
  const initials = session?.user?.name ? getInitials(session.user.name) : '??'
  const [schoolName, setSchoolName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/school').then((response) => response.json()).then((data) => setSchoolName(data.schoolName)).catch(() => {})
  }, [])

  const navItems = [
    { key: 'overview', label: 'Overview', icon: <Home size={18} />, href: '/admin' },
    { key: 'schools', label: 'School management', icon: <Building2 size={18} />, href: '/admin/schools' },
    { key: 'courses', label: 'Course management', icon: <BookOpen size={18} />, href: '/admin/courses' },
    { key: 'users', label: 'Users', icon: <Users size={18} />, href: '/admin/users' },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, href: '/admin/analytics' },
    { key: 'audit', label: 'Audit history', icon: <ClipboardList size={18} />, href: '/admin/audit-logs' },
  ].filter((item) => isAtlasAdmin || (isInstructor && (item.key === 'overview' || item.key === 'courses')))

  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
      <Logo />
      <div className="top-search"><Search size={17} /><input placeholder="Search admin" aria-label="Search admin" /></div>
      <nav className="top-nav">
        <Link href="/courses">Explore <ChevronRight size={14} /></Link>
        <button type="button">Support</button>
      </nav>
      <div className="top-actions">
        <span className="school-name">{schoolName || 'Atlas Learning'}</span>
        <NotificationBell />
        <div className="avatar">{initials}</div>
        <span className="user-name">{session?.user?.name || 'Loading...'}<small>{isInstructor ? 'Instructor' : 'Atlas Admin'}</small></span>
      </div>
    </header>
    <div className="body-layout">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-head">
          <Logo />
          <button className="icon-button close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`side-item ${active === item.key ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            {item.icon}<span>{item.label}</span>{active === item.key && <span className="active-pill" />}
          </Link>
        ))}
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

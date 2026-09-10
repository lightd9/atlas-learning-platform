'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Check, CircleAlert, X } from 'lucide-react'

type Notification = { id: string; title: string; body: string; href: string; tone: 'blue' | 'orange' | 'green' }

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<string[]>([])

  async function loadNotifications() {
    fetch('/api/notifications').then((response) => response.ok ? response.json() : { notifications: [] }).then((data) => setNotifications(data.notifications ?? [])).catch(() => {})
  }

  useEffect(() => {
    try { setReadIds(JSON.parse(window.localStorage.getItem('atlas-read-notifications') || '[]')) } catch {}
    loadNotifications()
  }, [])

  const unread = notifications.filter((notification) => !readIds.includes(notification.id))
  function markRead(id: string) {
    const next = [...new Set([...readIds, id])]
    setReadIds(next); window.localStorage.setItem('atlas-read-notifications', JSON.stringify(next))
  }
  function markAllRead() {
    const next = notifications.map((notification) => notification.id)
    setReadIds(next); window.localStorage.setItem('atlas-read-notifications', JSON.stringify(next))
  }

  return <div className="notification-root">
    <button className="icon-button notification-trigger" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) loadNotifications() }}><Bell size={18} />{unread.length > 0 && <span className="notification-count">{unread.length > 9 ? '9+' : unread.length}</span>}</button>
    {open && <div className="notification-panel" role="dialog" aria-label="Notifications"><div className="notification-panel-head"><div><strong>Notifications</strong><small>{unread.length ? `${unread.length} unread` : 'All caught up'}</small></div><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{unread.length > 0 && <button className="notification-mark-read" onClick={markAllRead}>Mark all read</button>}<button className="icon-button" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={15} /></button></div></div>{notifications.length === 0 ? <div className="notification-empty"><Check size={20} /><p>You&apos;re all caught up.</p></div> : <div className="notification-list">{notifications.map((notification) => <Link href={notification.href} key={notification.id} className={`notification-item ${readIds.includes(notification.id) ? 'read' : ''}`} onClick={() => { markRead(notification.id); setOpen(false) }}><span className={`notification-icon ${notification.tone}`}><CircleAlert size={15} /></span><span><strong>{notification.title}</strong><small>{notification.body}</small></span>{!readIds.includes(notification.id) && <i className="notification-unread-dot" aria-label="Unread" />}</Link>)}</div>}</div>}
  </div>
}

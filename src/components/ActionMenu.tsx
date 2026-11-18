'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export type MenuAction = { label: string; icon?: ReactNode; onSelect: () => void; disabled?: boolean; destructive?: boolean }

export default function ActionMenu({ label, actions, disabled = false }: { label: string; actions: MenuAction[]; disabled?: boolean }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const focusLast = useRef(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  function close() {
    setPosition(null)
    trigger.current?.focus()
  }

  function open(last = false) {
    if (disabled || !actions.some((action) => !action.disabled)) return
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    focusLast.current = last
    const width = Math.min(232, window.innerWidth - 24)
    const height = actions.length * 44 + 10
    const top = rect.bottom + height < window.innerHeight - 12 ? rect.bottom + 4 : Math.max(12, rect.top - height - 4)
    setPosition({ top, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)) })
  }

  useEffect(() => {
    if (!position) return
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (items?.length) items[focusLast.current ? items.length - 1 : 0].focus()
    function dismiss(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null)
    }
    function onScroll(event: Event) {
      if (!menu.current?.contains(event.target as Node)) setPosition(null)
    }
    function onResize() { setPosition(null) }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [position])

  if (!actions.length) return null

  return <>
    <button ref={trigger} type="button" className="icon-button action-menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={Boolean(position)} aria-controls={position ? id : undefined} disabled={disabled || actions.every((action) => action.disabled)}
      onClick={() => position ? close() : open()}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(event.key === 'ArrowUp') } }}>
      <MoreHorizontal size={18} />
    </button>
    {position && createPortal(<div ref={menu} id={id} role="menu" aria-label={label} className="action-menu" style={{ top: position.top, left: position.left }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return }
        if (event.key === 'Tab') { close(); return }
        const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : -1
        if (next >= 0 && items[next]) { event.preventDefault(); items[next].focus() }
      }}>
      {actions.map((action) => <button key={action.label} role="menuitem" type="button" tabIndex={-1} disabled={action.disabled} className={action.destructive ? 'destructive' : undefined}
        onClick={() => { close(); action.onSelect() }}>{action.icon}{action.label}</button>)}
    </div>, document.body)}
  </>
}

'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface AppModalProps {
  title: string
  eyebrow?: string
  description?: string
  icon?: React.ReactNode
  width?: number
  dirty?: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  confirmMessage?: string
}

export default function AppModal({
  title,
  eyebrow,
  description,
  icon,
  width = 520,
  dirty = false,
  onClose,
  children,
  footer,
  confirmMessage = 'You have unsaved changes. Are you sure you want to close? Your changes will be lost.',
}: AppModalProps) {
  const titleId = useId()
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')
  const [confirming, setConfirming] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.focus()
    setPhase('enter')
    return () => {
      previouslyFocused.current?.focus?.()
    }
  }, [])

  const close = useCallback(() => {
    setPhase('exit')
    window.setTimeout(() => {
      onClose()
    }, 160)
  }, [onClose])

  const requestClose = useCallback(() => {
    if (dirty && !confirming) {
      setConfirming(true)
      return
    }
    close()
  }, [dirty, confirming, close])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      const root = panelRef.current
      if (!root) return
      if (confirming) {
        setConfirming(false)
        return
      }
      requestClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirming, requestClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div
      className={`app-modal-root ${phase === 'exit' ? 'app-modal-exit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="app-modal-backdrop"
        onClick={requestClose}
        aria-hidden="true"
      />
      <div className="app-modal-panel" style={{ maxWidth: width }} role="none" ref={panelRef}>
        <div className="app-modal-header">
          {icon ? <span className="app-modal-icon">{icon}</span> : null}
          <div className="app-modal-heading">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h3 id={titleId}>{title}</h3>
            {description ? <p className="muted">{description}</p> : null}
          </div>
          <button
            type="button"
            className="icon-button app-modal-close"
            onClick={requestClose}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="app-modal-content">{children}</div>
        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>

      {confirming && (
        <div className="app-modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="app-modal-confirm-title">
          <div className="app-modal-confirm-card">
            <div className="app-modal-confirm-icon">
              <AlertTriangle size={20} />
            </div>
            <h4 id="app-modal-confirm-title">Discard unsaved changes?</h4>
            <p>{confirmMessage}</p>
            <div className="app-modal-confirm-actions">
              <button type="button" className="secondary-button" onClick={() => setConfirming(false)}>
                Keep editing
              </button>
              <button type="button" className="primary-button app-modal-confirm-danger" onClick={close}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminInvitationsPage from './page'

const { router, toast, bulkResend } = vi.hoisted(() => ({ router: { push: vi.fn() }, toast: vi.fn(), bulkResend: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated', data: { user: { id: 'admin-a', role: 'ATLAS_ADMIN' } } }) }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/components/AdminShell', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }))
vi.mock('@/components/Toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/useInvitationResend', () => ({ useInvitationResend: () => ({ resend: bulkResend, busy: false, results: [] }) }))

const invitations = [
  { id: 'alex', name: 'Alex Teacher', email: 'alex.a@example.invalid', role: 'TEACHER', status: 'PENDING', schoolName: 'North school', invitedBy: 'Verification admin', expiresAt: '2026-12-18T12:00:00Z', createdAt: '2026-11-18T12:00:00Z' },
  { id: 'jordan', name: 'Jordan Headteacher', email: 'jordan@example.invalid', role: 'HEADTEACHER', status: 'EXPIRED', schoolName: 'South school', invitedBy: 'Verification admin', expiresAt: '2026-11-01T12:00:00Z', createdAt: '2026-10-01T12:00:00Z' },
  { id: 'revoked', name: 'Revoked instructor', email: 'revoked@example.invalid', role: 'INSTRUCTOR', status: 'REVOKED', schoolName: null, invitedBy: 'Verification admin', expiresAt: '2026-11-01T12:00:00Z', createdAt: '2026-10-01T12:00:00Z' },
]

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ invitations }) }))) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('pending invitation search', () => {
  it('searches case-insensitive email, school and role text and recovers from no results', async () => {
    render(<AdminInvitationsPage />)
    await screen.findByText('Alex Teacher')
    const search = screen.getByRole('searchbox', { name: 'Search invitations' })
    expect(screen.queryByRole('columnheader', { name: 'School' })).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'ALEX.A@' } })
    expect(screen.getByText('Alex Teacher')).toBeInTheDocument()
    expect(screen.queryByText('Jordan Headteacher')).not.toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'south school' } })
    expect(screen.getByText('Jordan Headteacher')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'HEADTEACHER' } })
    expect(screen.getByText('1 of 3 invitations')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'no matching invitee' } })
    expect(screen.getByText('No invitations match your search')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('3 of 3 invitations')).toBeInTheDocument()
    expect(bulkResend).not.toHaveBeenCalled()
  })

  it('selects displayed resendable invitations while preserving explicit selections from another search', async () => {
    render(<AdminInvitationsPage />)
    await screen.findByText('Alex Teacher')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select invitation for Jordan Headteacher' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search invitations' }), { target: { value: 'Alex Teacher' } })
    fireEvent.click(screen.getByRole('button', { name: 'Select all displayed' }))
    expect(screen.getByRole('button', { name: 'Resend selected (2)' })).toBeEnabled()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search invitations' }), { target: { value: '' } })
    expect(screen.getByRole('checkbox', { name: 'Select invitation for Jordan Headteacher' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select invitation for Alex Teacher' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Select invitation for Revoked instructor' })).not.toBeInTheDocument()
    expect(bulkResend).not.toHaveBeenCalled()
  })
})

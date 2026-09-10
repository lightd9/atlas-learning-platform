import { describe, it, expect, vi, beforeEach } from 'vitest'
import { teacherInvitationEmail, headteacherSetupEmail, invitationResendEmail, invitationExpiredEmail, passwordResetEmail } from '@/lib/email'

describe('teacherInvitationEmail', () => {
  const email = teacherInvitationEmail('James Wilson', 'Oakfield Primary', 'token123abc', 'Amina Morgan')

  it('has correct subject', () => {
    expect(email.subject).toContain("You've been invited")
    expect(email.subject).toContain('Oakfield Primary')
  })

  it('includes teacher name in body', () => {
    expect(email.html).toContain('James Wilson')
  })

  it('includes inviter name', () => {
    expect(email.html).toContain('Amina Morgan')
  })

  it('includes school name', () => {
    expect(email.html).toContain('Oakfield Primary')
  })

  it('includes setup URL with token', () => {
    expect(email.html).toContain('/setup/token123abc')
  })

  it('includes Atlas branding', () => {
    expect(email.html).toContain('Atlas Learning')
  })

  it('includes a call-to-action button', () => {
    expect(email.html).toContain('Set up your account')
  })
})

describe('headteacherSetupEmail', () => {
  const email = headteacherSetupEmail('Amina Morgan', 'Oakfield Primary', 'token456def')

  it('has welcome subject', () => {
    expect(email.subject).toContain('Welcome')
    expect(email.subject).toContain('set up your school account')
  })

  it('includes name and school', () => {
    expect(email.html).toContain('Amina Morgan')
    expect(email.html).toContain('Oakfield Primary')
  })

  it('includes setup token', () => {
    expect(email.html).toContain('/setup/token456def')
  })
})

describe('invitationResendEmail', () => {
  const email = invitationResendEmail('Sarah Connor', 'St Marys', 'token789ghi')

  it('has reminder subject', () => {
    expect(email.subject).toContain('Reminder')
    expect(email.subject).toContain('St Marys')
  })

  it('includes setup link', () => {
    expect(email.html).toContain('/setup/token789ghi')
  })
})

describe('invitationExpiredEmail', () => {
  const email = invitationExpiredEmail('Sarah Connor', 'St Marys')

  it('has expired subject', () => {
    expect(email.subject).toContain('expired')
  })

  it('advises to ask for new invitation', () => {
    expect(email.html).toContain('new invitation')
  })
})

describe('passwordResetEmail', () => {
  const email = passwordResetEmail('James Wilson', 'resettoken123')

  it('has reset subject', () => {
    expect(email.subject).toContain('Reset')
    expect(email.subject).toContain('password')
  })

  it('includes reset link', () => {
    expect(email.html).toContain('/reset-password/resettoken123')
  })

  it('includes 1-hour expiry notice', () => {
    expect(email.html).toContain('1 hour')
  })
})

describe('sendEmail mock fallback', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', '')
  })

  it('logs to console when no API key is set', async () => {
    const { sendEmail } = await import('@/lib/email')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>test</p>' })
    expect(consoleSpy).toHaveBeenCalled()
    expect(result).toEqual({ id: 'mock' })
    consoleSpy.mockRestore()
  })
})
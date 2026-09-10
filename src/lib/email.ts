import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const FROM = process.env.EMAIL_FROM || 'Atlas Learning <onboarding@resend.dev>'
const BASE_URL = process.env.AUTH_URL || 'http://localhost:3000'

const roleCopy: Record<UserRole, { label: string; article: 'a' | 'an'; subject: string; description: string }> = {
  ATLAS_ADMIN: {
    label: 'Atlas Administrator',
    article: 'an',
    subject: 'You have been invited to administer Atlas Learning',
    description: 'You will be able to manage schools, users, courses, publication, and platform analytics.',
  },
  INSTRUCTOR: {
    label: 'Instructor',
    article: 'an',
    subject: 'You have been invited to create courses on Atlas Learning',
    description: 'You will be able to create and maintain the courses you own in the Atlas instructor workspace.',
  },
  HEADTEACHER: {
    label: 'Headteacher',
    article: 'a',
    subject: 'You have been invited to manage your school on Atlas Learning',
    description: 'You will be able to manage your school team, invitations, assigned learning, and school analytics.',
  },
  TEACHER: {
    label: 'Teacher',
    article: 'a',
    subject: 'You have been invited to learn with Atlas Learning',
    description: 'You will have access to your school\'s assigned courses and personal learning progress.',
  },
}

function layout(content: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6fa">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px #0000000d">
<tr><td style="padding:40px 36px 0;text-align:center">
<div style="display:inline-block;background:#2B5EA2;color:#fff;width:32px;height:32px;line-height:32px;border-radius:6px;font-weight:700">A</div>
<h1 style="font-size:22px;color:#101828;margin:16px 0 0;font-weight:700">Atlas Learning</h1>
</td></tr>
<tr><td style="padding:24px 36px 32px;color:#475467;font-size:15px;line-height:1.6">${content}</td></tr>
<tr><td style="padding:24px 36px;background:#f9fafc;color:#98a2b3;font-size:12px;text-align:center;border-top:1px solid #eaecf0">
<p style="margin:0 0 4px">Atlas Learning - Practical digital learning for schools</p>
<p style="margin:0">If you have questions, contact <a href="mailto:aolafenwa@gmail.com" style="color:#2B5EA2;text-decoration:none">Atlas Support</a></p>
</td></tr></table></td></tr></table></body></html>`
}

function button(href: string, text: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#2B5EA2;border-radius:8px;padding:0"><a href="${href}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:600;border-radius:8px">${text}</a></td></tr></table>`
}

export function roleInvitationEmail({ name, role, setupToken, invitedByName, schoolName }: { name: string; role: UserRole; setupToken: string; invitedByName: string; schoolName?: string | null }) {
  const copy = roleCopy[role]
  const context = schoolName ? ` for <strong>${schoolName}</strong>` : ''
  return {
    subject: schoolName ? `${copy.subject} - ${schoolName}` : copy.subject,
    html: layout(`<p>Hi ${name},</p><p><strong>${invitedByName}</strong> has invited you to join Atlas Learning as ${copy.article} <strong>${copy.label}</strong>${context}.</p><p>${copy.description}</p>${button(`${BASE_URL}/setup/${setupToken}`, 'Set up your account')}<p style="color:#98a2b3;font-size:13px">This secure invitation expires in 7 days. If you did not expect it, you can ignore this email.</p>`),
  }
}

export function teacherInvitationEmail(name: string, schoolName: string, setupToken: string, invitedByName: string) {
  const email = roleInvitationEmail({ name, schoolName, setupToken, invitedByName, role: 'TEACHER' })
  return { ...email, subject: `You've been invited to Atlas Learning - ${schoolName}` }
}

export function headteacherSetupEmail(name: string, schoolName: string, setupToken: string) {
  const email = roleInvitationEmail({ name, schoolName, setupToken, invitedByName: 'Atlas Learning', role: 'HEADTEACHER' })
  return { ...email, subject: 'Welcome to Atlas Learning - set up your school account' }
}

export function invitationResendEmail(name: string, schoolName: string, setupToken: string) {
  return { subject: `Reminder: Join ${schoolName} on Atlas Learning`, html: layout(`<p>Hi ${name},</p><p>This is a reminder that you are invited to join <strong>${schoolName}</strong> on Atlas Learning.</p>${button(`${BASE_URL}/setup/${setupToken}`, 'Set up your account')}<p style="color:#98a2b3;font-size:13px">This link expires in 7 days.</p>`) }
}

export function invitationExpiredEmail(name: string, schoolName: string) {
  return { subject: 'Your Atlas Learning invitation has expired', html: layout(`<p>Hi ${name},</p><p>Your invitation to join <strong>${schoolName}</strong> on Atlas Learning has expired.</p><p>Please ask your headteacher to send a new invitation.</p>`) }
}

export function passwordResetEmail(name: string, token: string) {
  return { subject: 'Reset your Atlas Learning password', html: layout(`<p>Hi ${name},</p><p>We received a request to reset your Atlas Learning password.</p>${button(`${BASE_URL}/reset-password/${token}`, 'Reset password')}<p style="color:#98a2b3;font-size:13px">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`) }
}

export async function sendEmail({ to, subject, html, type = 'TRANSACTIONAL' }: { to: string; subject: string; html: string; type?: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[EMAIL] Would send to ${to}: ${subject}`)
    await recordEmailDelivery({ to, subject, type, status: 'MOCKED', providerId: 'mock' })
    return { id: 'mock' }
  }
  const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM, to, subject, html }) })
  if (!res.ok) {
    const error = await res.text()
    await recordEmailDelivery({ to, subject, type, status: 'FAILED', error: error.slice(0, 1000) })
    throw new Error('Failed to send email')
  }
  const data = await res.json()
  await recordEmailDelivery({ to, subject, type, status: 'SENT', providerId: data.id })
  return data
}

async function recordEmailDelivery(data: { to: string; subject: string; type: string; status: string; providerId?: string; error?: string }) {
  try { await prisma.emailDelivery.create({ data }) } catch (error) { console.error('[EMAIL] Unable to record delivery status', error) }
}

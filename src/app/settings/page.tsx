'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { CheckCircle2, LockKeyhole, Save, ShieldCheck, UserRound } from 'lucide-react'
import AccountShell from '@/components/AccountShell'
import { useToast } from '@/components/Toast'
import PasswordInput from '@/components/PasswordInput'

export default function SettingsPage() {
  const { update } = useSession()
  const { toast } = useToast()
  const [schoolName, setSchoolName] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [emailUpdates, setEmailUpdates] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  useEffect(() => {
    fetch('/api/school').then((response) => response.json()).then((data) => setSchoolName(data.schoolName ?? 'Atlas Learning')).catch(() => setSchoolName('Atlas Learning'))
    fetch('/api/account/profile').then((response) => response.ok ? response.json() : null).then((data) => { if (data?.user) { setName(data.user.name); setEmail(data.user.email); setRole(data.user.role) } }).catch(() => {})
    setEmailUpdates(window.localStorage.getItem('atlas-email-updates') !== 'false')
  }, [])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setProfileError(''); setProfileMessage('')
    setProfileSaving(true)
    const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email }) })
    const data = await response.json(); setProfileSaving(false)
    if (!response.ok) { const message = data.error ?? 'Unable to update profile.'; setProfileError(message); toast(message, 'error'); return }
    await update({ name: data.user.name, email: data.user.email })
    setProfileMessage('Profile updated successfully.')
    toast('Changes saved', 'success')
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault(); setPasswordError(''); setPasswordMessage('')
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    setSavingPassword(true)
    const response = await fetch('/api/account/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
    const data = await response.json(); setSavingPassword(false)
    if (!response.ok) { const message = data.error ?? 'Unable to update password.'; setPasswordError(message); toast(message, 'error'); return }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Password updated successfully.'); toast('Password updated', 'success')
  }

  function savePreferences(value: boolean) {
    setEmailUpdates(value); window.localStorage.setItem('atlas-email-updates', String(value)); toast('Preference saved', 'success')
  }

  return <AccountShell active="settings"><div className="page-wrap">
    <div className="page-heading compact"><div><p className="eyebrow">Account</p><h1>Settings</h1><p className="muted">Manage your Atlas account, security and preferences.</p></div></div>
    <div className="account-layout" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 18 }}>
      <div>
        <section className="panel" style={{ marginBottom: 18 }}><div className="panel-head"><div><p className="eyebrow">Profile</p><h2>Account details</h2></div><UserRound size={20} className="muted-icon" /></div><form onSubmit={saveProfile}><div className="account-fields" style={fieldGrid}><label style={labelStyle}>Full name<input value={name} onChange={(event) => setName(event.target.value)} required style={inputStyle} /></label><label style={labelStyle}>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required style={inputStyle} /></label><label style={labelStyle}>Role<input value={formatRole(role)} readOnly style={{ ...inputStyle, background: '#f7f8fb' }} /></label><label style={labelStyle}>School or workspace<input value={schoolName || 'Atlas Learning'} readOnly style={{ ...inputStyle, background: '#f7f8fb' }} /></label></div><p className="muted" style={{ fontSize: 11, marginTop: 14 }}>Your name and email can be updated here. Role and school are managed by Atlas or your school administrator.</p>{profileError && <p role="alert" style={{ color: '#b42318', fontSize: 12, margin: '12px 0 0' }}>{profileError}</p>}{profileMessage && <p role="status" style={{ color: 'var(--green)', fontSize: 12, margin: '12px 0 0' }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{profileMessage}</p>}<button className="primary-button" type="submit" disabled={profileSaving} style={{ marginTop: 14 }}><Save size={16} />{profileSaving ? 'Saving...' : 'Save changes'}</button></form></section>
        <section className="panel"><div className="panel-head"><div><p className="eyebrow">Security</p><h2>Change password</h2></div><LockKeyhole size={20} className="muted-icon" /></div><form onSubmit={updatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><label style={labelStyle}>Current password<PasswordInput autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required style={inputStyle} /></label><div style={fieldGrid}><label style={labelStyle}>New password<PasswordInput autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required style={inputStyle} /></label><label style={labelStyle}>Confirm new password<PasswordInput autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required style={inputStyle} /></label></div><p className="muted" style={{ fontSize: 11 }}>Use at least 8 characters. You will stay signed in after updating your password.</p>{passwordError && <p role="alert" style={{ color: '#b42318', fontSize: 12, margin: 0 }}>{passwordError}</p>}{passwordMessage && <p role="status" style={{ color: 'var(--green)', fontSize: 12, margin: 0 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{passwordMessage}</p>}<button className="primary-button" type="submit" disabled={savingPassword}><Save size={16} />{savingPassword ? 'Updating...' : 'Update password'}</button></form></section>
      </div>
      <section className="panel" style={{ alignSelf: 'start' }}><div className="panel-head"><div><p className="eyebrow">Preferences</p><h2>Notifications</h2></div><ShieldCheck size={20} className="muted-icon" /></div><label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}><input type="checkbox" checked={emailUpdates} onChange={(event) => savePreferences(event.target.checked)} style={{ marginTop: 3 }} /><span><strong>Email updates</strong><small style={{ display: 'block', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>Receive important Atlas learning and account updates by email.</small></span></label><div style={{ borderTop: '1px solid var(--line)', marginTop: 20, paddingTop: 18 }}><p className="muted" style={{ fontSize: 12 }}>Security and invitation emails cannot be disabled.</p></div></section>
    </div>
  </div></AccountShell>
}

function formatRole(role: string) { return role === 'ATLAS_ADMIN' ? 'Atlas Admin' : role === 'INSTRUCTOR' ? 'Instructor' : role === 'HEADTEACHER' ? 'Headteacher' : role === 'TEACHER' ? 'Teacher' : 'Loading...' }
const fieldGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151' }
const inputStyle: React.CSSProperties = { height: 42, borderRadius: 8, border: '1px solid var(--line)', padding: '0 12px', fontSize: 13, background: '#00000', width: '100%' }

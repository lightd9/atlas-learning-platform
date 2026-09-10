'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen, ChevronDown, Mail, Search, ShieldCheck, Users } from 'lucide-react'
import AccountShell from '@/components/AccountShell'

const articles = [
  { title: 'How do I start a course?', text: 'Open My learning or Explore, choose a course, then select a lesson. Your video progress is saved automatically while you watch.', icon: <BookOpen size={18} /> },
  { title: 'How do teacher invitations work?', text: 'Headteachers can invite teachers individually or upload a CSV file. Invitations expire after seven days and can be resent while pending or expired.', icon: <Users size={18} /> },
  { title: 'How is progress tracked?', text: 'Atlas records watch time and marks lessons complete automatically when the completion threshold is reached.', icon: <ShieldCheck size={18} /> },
]

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(0)
  const filtered = useMemo(() => articles.filter((article) => `${article.title} ${article.text}`.toLowerCase().includes(query.toLowerCase())), [query])
  return <AccountShell active="help"><div className="page-wrap">
    <div className="page-heading compact"><div><p className="eyebrow">Atlas Support</p><h1>Help centre</h1><p className="muted">Find quick answers or contact the Atlas Support team.</p></div><Link href="/contact" className="primary-button">Contact support <ArrowUpRight size={16} /></Link></div>
    <div className="panel" style={{ marginBottom: 18 }}><p className="eyebrow">How can we help?</p><div className="top-search" style={{ width: '100%', maxWidth: 560, background: '#fff' }}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles" aria-label="Search help articles" /></div></div>
    <div className="help-layout" style={{ display: 'grid', gridTemplateColumns: '1fr .7fr', gap: 18 }}><section className="panel"><div className="panel-head"><div><p className="eyebrow">Popular help</p><h2>Common questions</h2></div></div>{filtered.length === 0 ? <p className="muted">No help articles matched your search. Contact Atlas Support and we&apos;ll help you directly.</p> : filtered.map((article, index) => <div key={article.title} style={{ borderTop: '1px solid var(--line)', padding: '16px 0' }}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index} style={{ border: 0, background: 'transparent', padding: 0, width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', color: 'var(--navy)', cursor: 'pointer' }}><span style={{ color: 'var(--blue)' }}>{article.icon}</span><strong style={{ flex: 1 }}>{article.title}</strong><ChevronDown size={17} style={{ transform: open === index ? 'rotate(180deg)' : undefined, transition: '.2s' }} /></button>{open === index && <p className="muted" style={{ margin: '12px 0 0 28px', lineHeight: 1.7 }}>{article.text}</p>}</div>)}</section><aside><div className="panel" style={{ marginBottom: 18 }}><Mail size={22} color="var(--blue)" /><h3 style={{ marginTop: 14 }}>Still need help?</h3><p className="muted">Send us a message and include your school name and the email you use for Atlas.</p><a href="mailto:contact@atlassupport.co.uk" className="text-button" style={{ marginTop: 12 }}>Email Atlas Support <ArrowUpRight size={15} /></a></div><div className="panel"><p className="eyebrow">Quick links</p><Link href="/courses" className="side-item" style={{ paddingLeft: 0 }}>Browse courses <ArrowUpRight size={15} /></Link><Link href="/settings" className="side-item" style={{ paddingLeft: 0 }}>Account settings <ArrowUpRight size={15} /></Link></div></aside></div>
  </div></AccountShell>
}


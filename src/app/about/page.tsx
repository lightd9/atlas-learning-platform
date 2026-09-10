'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import PublicFooter from '@/components/PublicFooter'
import PublicNavbar from '@/components/PublicNavbar'

export default function AboutPage() {
  return <div className="atlas-public-home public-site public-content-page">
    <PublicNavbar />

    <section className="simple-public-page">
      <p className="public-kicker"><span /> About Atlas Learning</p>
      <h1>Helping schools build<br /><em>digital confidence.</em></h1>
      <p className="lead">Atlas Learning is an extension of Atlas Support&apos;s work with schools, academies and Multi-Academy Trusts. We turn complex technology topics into clear, practical learning that staff can use in their day-to-day roles.</p>
      <div className="about-columns">
        <div><h2>Learning that respects your time</h2><p>Busy school teams do not need more theory. Our courses are short, focused and designed to fit around the demands of the school day.</p></div>
        <div><h2>Technology with good judgement</h2><p>From AI safety to digital productivity, we help education professionals make informed decisions while keeping people, privacy and purpose at the centre.</p></div>
      </div>
      <Link className="primary-button" href="/courses">Explore our courses <ArrowUpRight size={16} /></Link>
    </section>

    <PublicFooter />
  </div>
}

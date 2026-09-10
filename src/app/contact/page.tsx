'use client'

import PublicFooter from '@/components/PublicFooter'
import PublicNavbar from '@/components/PublicNavbar'

export default function ContactPage() {
  return <div className="atlas-public-home public-site public-content-page">
    <PublicNavbar />

    <section className="simple-public-page contact-public">
      <p className="public-kicker"><span /> Get in touch</p>
      <h1>We&apos;re here to help<br /><em>your school move forward.</em></h1>
      <p className="lead">Have a question about Atlas Learning or how Atlas Support can support your school? Our team would be happy to hear from you.</p>
      <div className="contact-card">
        <div><span>Email us</span><strong>contact@atlassupport.co.uk</strong><p>We&apos;ll get back to you as soon as we can.</p></div>
        <div><span>Visit Atlas Support</span><strong>atlassupport.co.uk</strong><p>IT support, cybersecurity and digital transformation.</p></div>
      </div>
    </section>

    <PublicFooter />
  </div>
}

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="login-page" style={{ textAlign: 'center' }}>
      <div className="login-card" style={{ maxWidth: 420 }}>
        <span className="login-symbol" style={{ fontSize: 48, lineHeight: 1 }}>404</span>
        <h2>Page not found</h2>
        <p className="muted">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/dashboard" className="primary-button" style={{ display: 'inline-flex', marginTop: 16 }}>
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40, fontFamily: 'DM Sans, sans-serif', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#f8f9fc' }}>
      <h1 style={{ fontSize: 29, color: '#172033', margin: '0 0 8px' }}>Something went wrong</h1>
      <p style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.6, margin: '0 0 25px' }}>{error.message || 'An unexpected error occurred.'}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button onClick={reset} style={{ background: '#2B5EA2', color: '#fff', border: 0, borderRadius: 18, padding: '10px 18px', fontSize: 10, cursor: 'pointer', boxShadow: '0 5px 13px #2B5EA22b' }}>
          Try again
        </button>
        <a href="/" style={{ background: '#fff', color: '#172033', border: '1px solid #dfe4ed', borderRadius: 18, padding: '10px 18px', fontSize: 10, textDecoration: 'none' }}>
          Go home
        </a>
      </div>
    </div>
  )
}


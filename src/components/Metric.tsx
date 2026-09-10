import { ReactNode } from 'react'

export default function Metric({ label, value, change, icon, sublabel, iconClass = '' }: { label: string; value: string; change?: string; icon: ReactNode; sublabel?: string; iconClass?: string }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${iconClass}`}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sublabel ?? change}</small>
    </div>
  )
}

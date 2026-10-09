import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: string
  /** Aclaración chica bajo la etiqueta. */
  hint?: string
  to?: string
}

/** Número destacado de las estadísticas; con `to`, lleva a la biblioteca filtrada. */
export function StatTile({ icon: Icon, label, value, hint, to }: StatTileProps) {
  const content = (
    <>
      <Icon size={18} className="text-accent" />
      <p className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-lavender">{label}</p>
      {hint && <p className="text-[11px] text-lavender/80">{hint}</p>}
    </>
  )
  const className = 'block rounded-2xl bg-background-surface p-3.5 ring-1 ring-primary-dark/30'
  return to ? (
    <Link to={to} className={`${className} transition-transform active:scale-[0.98]`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

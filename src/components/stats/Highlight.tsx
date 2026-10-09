import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { GameThumb } from '../GameThumb'

interface HighlightProps {
  icon: LucideIcon
  label: string
  title: string
  detail?: string
  cover?: string | null
  to: string
}

/** Destacado con portada (mejor puntuado, el más largo...), que abre su detalle. */
export function Highlight({ icon: Icon, label, title, detail, cover, to }: HighlightProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl bg-background-surface p-2.5 ring-1 ring-primary-dark/30 active:bg-primary-dark/20"
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-primary-dark/20">
        <GameThumb src={cover ?? null} alt="" className="h-full w-full object-cover" icon={Icon} />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-xs text-lavender">
          <Icon size={12} /> {label}
        </p>
        <p className="truncate font-semibold text-ink">{title}</p>
        {detail && <p className="truncate text-xs text-lavender">{detail}</p>}
      </div>
    </Link>
  )
}

import { Link } from 'react-router-dom'

export interface RankRow {
  label: string
  value: number
  /** Texto del valor (por defecto, el número). */
  display?: string
  to?: string
}

/** Ranking en barras horizontales etiquetadas (magnitud, un tono). */
export function RankBars({ rows }: { rows: RankRow[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="w-28 shrink-0 truncate text-sm text-lavender">{r.label}</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-primary-dark/20">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
            <span className="min-w-8 shrink-0 text-right text-sm font-medium tabular-nums text-ink">
              {r.display ?? r.value}
            </span>
          </>
        )
        return (
          <li key={r.label}>
            {r.to ? (
              <Link to={r.to} className="flex min-h-9 items-center gap-3 rounded-lg active:bg-primary-dark/20">
                {inner}
              </Link>
            ) : (
              <div className="flex min-h-9 items-center gap-3">{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

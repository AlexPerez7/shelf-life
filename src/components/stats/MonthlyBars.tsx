import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SectionCard } from '../SectionCard'
import { Skeleton } from '../Skeleton'
import type { MonthBucket } from '../../lib/stats'

interface MonthlyBarsProps {
  icon: LucideIcon
  title: string
  /** `null` mientras carga. */
  months: MonthBucket[] | null
  format: (value: number) => string
  emptyText: string
  /** Detalle extra del mes elegido (ej. "12 episodios · 2 películas"). */
  detail?: (index: number) => ReactNode
  footnote?: string
}

/** Barras por mes (una sola serie, un tono); tocar una muestra su valor. */
export function MonthlyBars({ icon, title, months, format, emptyText, detail, footnote }: MonthlyBarsProps) {
  const [selected, setSelected] = useState<number | null>(null)

  if (months == null) {
    return (
      <SectionCard icon={icon} title={title}>
        <Skeleton className="h-40 w-full" />
      </SectionCard>
    )
  }

  const index = selected ?? months.length - 1
  const current = months[index]
  const max = Math.max(...months.map((m) => m.value), 1)
  const empty = months.every((m) => m.value === 0)

  return (
    <SectionCard icon={icon} title={title}>
      {empty ? (
        <p className="text-sm text-lavender">{emptyText}</p>
      ) : (
        <>
          <p className="text-sm text-lavender first-letter:uppercase">{current.long}</p>
          <p className="text-2xl font-bold tabular-nums text-ink">{format(current.value)}</p>
          <div className="mb-3 min-h-4 text-xs text-lavender">{detail?.(index)}</div>
          <div className="flex h-32 items-end gap-2 border-b border-primary-dark/40" role="list" aria-label={title}>
            {months.map((m, i) => (
              <button
                key={m.key}
                type="button"
                role="listitem"
                onClick={() => setSelected(i)}
                aria-label={`${m.long}: ${format(m.value)}`}
                aria-pressed={i === index}
                className="flex h-full flex-1 items-end justify-center"
              >
                <span
                  className={`w-full max-w-7 rounded-t transition-colors ${i === index ? 'bg-accent' : 'bg-primary-dark/60'}`}
                  style={{ height: `${Math.max(m.value > 0 ? 3 : 0, (m.value / max) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {months.map((m, i) => (
              <span
                key={m.key}
                className={`flex-1 text-center text-[11px] capitalize ${
                  i === index ? 'font-semibold text-ink' : 'text-lavender'
                }`}
              >
                {m.short}
              </span>
            ))}
          </div>
          {footnote && <p className="mt-2 text-xs text-lavender/80">{footnote}</p>}
        </>
      )}
    </SectionCard>
  )
}

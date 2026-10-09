import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Play, Plus, type LucideIcon } from 'lucide-react'
import { GameThumb } from './GameThumb'
import { Skeleton } from './Skeleton'
import { buildHistory, type HistoryKind } from '../lib/history'
import { formatMinutes, mediaTypeIcons, type MediaSection } from '../lib/media'
import type { ActivityRow } from '../lib/stats'
import type { Item, NonGameType } from '../types/item'

/** Días que se muestran de entrada (y cuántos más con "Ver más"). */
const DAYS_PAGE = 30

/** Ícono chico de los hitos (la actividad lleva solo la portada). */
const KIND_ICONS: Partial<Record<HistoryKind, LucideIcon>> = {
  added: Plus,
  started: Play,
  finished: CheckCircle2,
}

interface HistoryFeedProps {
  section: MediaSection
  items: Item[]
  /** `null` mientras carga. */
  activity: ActivityRow[] | null
  loading: boolean
  emptyText: string
  /** Clase extra para los títulos (ej. serif en Libros). */
  titleClassName?: string
}

/**
 * Historial día por día: cada evento con su portada, lo que pasó y el
 * tiempo; cada día con su total. Tocar un evento abre el detalle.
 */
export function HistoryFeed({ section, items, activity, loading, emptyText, titleClassName = '' }: HistoryFeedProps) {
  const days = useMemo(() => (activity ? buildHistory(items, activity) : null), [items, activity])
  const [shown, setShown] = useState(DAYS_PAGE)

  if (loading || days == null) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (days.length === 0) {
    return <p className="mt-8 text-center text-sm text-lavender">{emptyText}</p>
  }

  return (
    <>
      {days.slice(0, shown).map((day) => (
        <section key={day.key} className="mb-4">
          <h2
            className="sticky z-10 -mx-4 flex items-baseline justify-between gap-2 bg-background/95 px-4 py-2"
            style={{ top: 'env(safe-area-inset-top)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-lavender first-letter:uppercase">
              {day.label}
            </span>
            {day.minutes > 0 && (
              <span className="text-xs font-medium tabular-nums text-accent">{formatMinutes(day.minutes)}</span>
            )}
          </h2>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-background-surface ring-1 ring-primary-dark/30">
            {day.events.map((e) => {
              const KindIcon = KIND_ICONS[e.kind]
              return (
                <li key={e.key} className="border-b border-primary-dark/20 last:border-b-0">
                  <Link
                    to={section.detailPath(e.item.id)}
                    className="flex items-center gap-3 p-2.5 active:bg-primary-dark/20"
                  >
                    <div className="relative h-14 w-10 shrink-0">
                      <div className="h-full w-full overflow-hidden rounded-md bg-primary-dark/20">
                        <GameThumb
                          size="thumb"
                          src={e.item.cover_url}
                          alt=""
                          className="h-full w-full object-cover"
                          icon={mediaTypeIcons[e.item.media_type as NonGameType]}
                        />
                      </div>
                      {KindIcon && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-background ring-2 ring-background-surface">
                          <KindIcon size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-lavender">
                        {e.text}{' '}
                        <span className={`font-semibold text-ink ${titleClassName}`}>{e.item.title}</span>
                      </p>
                      {e.detail && <p className="text-xs text-lavender">{e.detail}</p>}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {days.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + DAYS_PAGE)}
          className="flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/40 active:bg-primary-dark/20"
        >
          Ver más
        </button>
      )}
    </>
  )
}

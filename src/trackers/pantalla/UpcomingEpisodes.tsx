import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { GameThumb } from '../../components/GameThumb'
import { airLabel, episodeCode, type UpcomingEntry } from '../../hooks/useUpcoming'
import { mediaSections, mediaTypeIcons } from '../../lib/media'
import type { ScreenType } from '../../types/item'

const section = mediaSections.pantalla

/**
 * Próximos episodios de lo que sigues: una fila de tarjetas con la fecha
 * ("Mañana", "El viernes") y el episodio ("T2 · E5"). En la biblioteca de
 * Pantalla y, con los de la semana, en el inicio.
 */
export function UpcomingEpisodes({
  entries,
  title = 'Próximos episodios',
  className = 'mb-6',
}: {
  entries: UpcomingEntry[]
  title?: string
  className?: string
}) {
  if (entries.length === 0) return null
  return (
    <section className={className}>
      <h2 className="mb-2 flex items-center gap-1.5 text-lg font-semibold text-ink">
        <CalendarClock size={18} className="text-accent" /> {title}
      </h2>
      <div className="scrollbar-hide -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1">
        {entries.map(({ item, episode, date }) => (
          <Link
            key={item.id}
            to={section.detailPath(item.id)}
            data-tracker="pantalla"
            className="flex w-56 shrink-0 snap-start items-center gap-2.5 rounded-2xl bg-background-surface p-2 ring-1 ring-primary-dark/40 active:bg-primary-dark/20"
          >
            <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-primary-dark/30">
              <GameThumb
                size="thumb"
                src={item.cover_url}
                alt=""
                className="h-full w-full object-cover"
                icon={mediaTypeIcons[item.media_type as ScreenType]}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-accent">{airLabel(date)}</p>
              <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
              <p className="truncate text-xs text-lavender">
                {episodeCode(episode)}
                {episode.name ? ` · ${episode.name}` : ''}
              </p>
            </div>
          </Link>
        ))}
        <div className="shrink-0 basis-1" aria-hidden="true" />
      </div>
    </section>
  )
}

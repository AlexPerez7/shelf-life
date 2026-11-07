import { Link } from 'react-router-dom'
import { GameThumb } from '../../components/GameThumb'
import { airShort, episodeCode, type UpcomingEntry } from '../../hooks/useUpcoming'
import { mediaSections, mediaTypeIcons } from '../../lib/media'
import type { ScreenType } from '../../types/item'

const section = mediaSections.pantalla

/** "Sale esta semana": los próximos episodios de lo que sigues, en un carrusel con el día de estreno. */
export function UpcomingRail({ entries }: { entries: UpcomingEntry[] }) {
  if (entries.length === 0) return null
  return (
    <section aria-label="Sale esta semana" data-tracker="pantalla">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">Sale esta semana</h2>
        <span className="text-sm text-lavender">
          {entries.length} {entries.length === 1 ? 'episodio' : 'episodios'}
        </span>
      </div>
      <ul className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {entries.map(({ item, episode, date }) => (
          <li key={`${item.id}-${episode.season}-${episode.episode}`} className="w-41 shrink-0">
            <Link to={section.detailPath(item.id)} className="block active:opacity-80">
              <div className="relative h-24 w-41 overflow-hidden rounded-2xl bg-ink/10">
                <GameThumb
                  size="poster"
                  src={item.cover_url}
                  alt=""
                  className="h-full w-full object-cover object-top"
                  icon={mediaTypeIcons[item.media_type as ScreenType]}
                />
                <span className="absolute top-2.5 left-2.5 rounded-lg bg-background/85 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink">
                  {airShort(date)}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-accent">{episodeCode(episode)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

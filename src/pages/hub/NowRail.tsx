import { Link } from 'react-router-dom'
import { GameThumb } from '../../components/GameThumb'
import { Ring } from '../../components/Ring'
import type { NowModel } from './nowModel'

/** "En curso": el resto de lo que sigues, en un carrusel de portadas con el avance y la acción de un toque. */
export function NowRail({ entries }: { entries: NowModel[] }) {
  if (entries.length === 0) return null
  return (
    <section aria-label="En curso">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">En curso</h2>
        <span className="text-sm text-lavender">{entries.length + 1} títulos</span>
      </div>
      <ul className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {entries.map((m) => (
          <li key={m.key} data-tracker={m.tracker} className="relative w-28 shrink-0">
            <Link to={m.to} className="block active:opacity-80">
              <div className="relative h-42 w-28 overflow-hidden rounded-2xl bg-ink/10 shadow-lg shadow-black/30">
                <GameThumb
                  size="poster"
                  src={m.cover}
                  alt=""
                  className="h-full w-full object-cover"
                  placeholderClassName="text-2xl"
                  icon={m.icon}
                />
                {m.pct != null && (
                  <div className="absolute top-2 right-2 rounded-full bg-background/85 p-0.5">
                    <Ring percent={m.pct} size={32} stroke={4} label={`${m.pct} por ciento`} />
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-tight font-semibold text-ink">{m.title}</p>
              <p className="mt-0.5 truncate text-xs text-accent">{m.progress}</p>
            </Link>
            {m.quick}
          </li>
        ))}
      </ul>
    </section>
  )
}

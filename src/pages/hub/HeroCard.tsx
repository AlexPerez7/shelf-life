import { Link } from 'react-router-dom'
import { GameThumb } from '../../components/GameThumb'
import { Ring } from '../../components/Ring'
import type { NowModel } from './nowModel'

/**
 * "Continuar": lo último que usaste, con la portada grande, el avance y la
 * acción de un toque. Toma el color de su tracker (`data-tracker`).
 */
export function HeroCard({ m }: { m: NowModel }) {
  return (
    <section
      aria-label="Continuar"
      data-tracker={m.tracker}
      className="flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-ink/10"
      style={{
        background:
          'linear-gradient(160deg, color-mix(in oklab, var(--color-accent) 30%, var(--color-background)) 0%, var(--color-background-surface) 100%)',
      }}
    >
      <Link to={m.to} className="flex gap-4 active:opacity-90">
        <div className="h-[10.5rem] w-28 shrink-0 overflow-hidden rounded-2xl bg-ink/10 shadow-xl shadow-black/40">
          <GameThumb
            size="poster"
            src={m.cover}
            alt=""
            className="h-full w-full object-cover"
            placeholderClassName="text-3xl"
            icon={m.icon}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{m.kicker}</p>
            <h2 className="font-display mt-1.5 line-clamp-3 text-3xl leading-[1.05] font-extrabold tracking-tight text-ink">
              {m.title}
            </h2>
            <p className="mt-1 truncate text-sm text-ink/70">{m.byline}</p>
          </div>
          <div className="flex items-center gap-3">
            {m.pct != null && (
              <Ring percent={m.pct} size={60} stroke={6} label={`${m.pct} por ciento`}>
                <span className="text-sm font-semibold tabular-nums">{m.pct}%</span>
              </Ring>
            )}
            <p className="min-w-0 text-sm font-medium text-ink">{m.progress}</p>
          </div>
        </div>
      </Link>
      <div className="flex gap-2.5">{m.primary}</div>
    </section>
  )
}

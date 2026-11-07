import { Link } from 'react-router-dom'
import { Ring } from '../../components/Ring'
import { useGoals } from '../../hooks/useGoals'
import { goalDone, goalUnits } from '../../lib/goals'
import { trackerIds, trackers } from '../../trackers/trackers'
import type { Game } from '../../types/game'
import type { Item } from '../../types/item'

/** Metas del año que tengas puestas, como anillos; tocar una lleva a las estadísticas de su tracker. */
export function GoalRings({ games, items }: { games: Game[]; items: Item[] }) {
  const year = new Date().getFullYear()
  const { goals } = useGoals(year)
  const shown = trackerIds
    .map((id) => goals.find((g) => g.tracker === id && g.kind === 'items'))
    .filter((g) => g != null)
  if (shown.length === 0) return null

  return (
    <section aria-label={`Metas ${year}`}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-ink">Metas {year}</h2>
        <span className="text-sm text-lavender">del año</span>
      </div>
      <ul className="grid grid-cols-3 gap-2.5">
        {shown.map((goal) => {
          const done = goalDone(goal.tracker, year, games, items)
          const pct = Math.min(100, Math.round((done / goal.target) * 100))
          return (
            <li key={goal.tracker} data-tracker={goal.tracker}>
              <Link
                to={`${trackers[goal.tracker].base}/estadisticas`}
                className="flex min-h-11 flex-col items-center gap-2 rounded-2xl bg-background-surface px-2 pt-3.5 pb-3 active:bg-primary-dark/20"
              >
                <Ring
                  percent={pct}
                  size={64}
                  stroke={6}
                  label={`${done} de ${goal.target} ${goalUnits[goal.tracker][1]}`}
                >
                  <span className="text-base font-semibold tabular-nums">{done}</span>
                </Ring>
                <p className="text-center text-xs leading-snug text-lavender">
                  de {goal.target} {goalUnits[goal.tracker][1]}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

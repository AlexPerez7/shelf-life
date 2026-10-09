import { useState } from 'react'
import { Pencil, Target } from 'lucide-react'
import { useGames } from '../../hooks/useGames'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { useGoals } from '../../hooks/useGoals'
import { goalDone, goalPace, goalUnits } from '../../lib/goals'
import { haptic } from '../../lib/haptics'
import { BottomSheet } from '../BottomSheet'
import type { TrackerId } from '../../trackers/trackers'

/** Texto de cómo va la meta respecto del calendario. */
function paceText(pace: number | null, left: number) {
  if (left <= 0) return '¡Meta cumplida! 🎉'
  if (pace == null) return null
  if (pace > 0) return `Vas ${pace} por delante`
  if (pace < 0) return `Te ${pace === -1 ? 'falta 1' : `faltan ${-pace}`} para ir al día`
  return 'Vas al día'
}

/**
 * Meta del año de un tracker, arriba de sus estadísticas: avance, si vas al
 * día y una hoja para ponerla, cambiarla o quitarla. No se muestra si la
 * tabla de metas todavía no existe.
 */
export function GoalCard({ tracker }: { tracker: TrackerId }) {
  const year = new Date().getFullYear()
  const { goals, available, setGoal } = useGoals(year)
  const { games } = useGames()
  const { items } = useMedia()
  const { showToast, showError } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!available) return null

  const goal = goals.find((g) => g.tracker === tracker) ?? null
  const done = goalDone(tracker, year, games, items)
  const [singular, plural] = goalUnits[tracker]

  function openEditor() {
    setValue(goal ? String(goal.target) : '')
    setEditing(true)
  }

  async function save(target: number | null) {
    setEditing(false)
    haptic()
    try {
      await setGoal(tracker, target)
      showToast(target == null ? 'Meta quitada' : `Meta ${year}: ${target} ${target === 1 ? singular : plural}`)
    } catch (err) {
      showError(err, 'No se pudo guardar la meta')
    }
  }

  const n = Number(value)
  const valid = Number.isInteger(n) && n >= 1 && n <= 10000

  const sheet = (
    <BottomSheet open={editing} onClose={() => setEditing(false)} title={`Meta ${year}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) save(n)
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-lavender">¿Cuántos {plural} este año?</span>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            min={1}
            max={10000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl bg-background px-3 py-2.5 text-ink ring-1 ring-primary-dark/40 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="submit"
          disabled={!valid}
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-background disabled:opacity-50"
        >
          Guardar meta
        </button>
        {goal && (
          <button
            type="button"
            onClick={() => save(null)}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-xl font-medium text-error active:bg-error/10"
          >
            Quitar meta
          </button>
        )}
      </form>
    </BottomSheet>
  )

  if (!goal) {
    return (
      <>
        <button
          type="button"
          onClick={openEditor}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-accent/50 px-4 text-left active:bg-accent/10"
        >
          <Target size={20} className="shrink-0 text-accent" />
          <span className="text-sm text-ink">
            Ponte una meta para {year}
            <span className="block text-xs text-lavender">
              Llevas {done} {done === 1 ? singular : plural} este año
            </span>
          </span>
        </button>
        {sheet}
      </>
    )
  }

  const pct = Math.min(100, Math.round((done / goal.target) * 100))
  const status = paceText(goalPace(goal, done), goal.target - done)

  return (
    <>
      <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/30">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Target size={16} className="text-accent" /> Meta {year}
          </p>
          <button
            type="button"
            onClick={openEditor}
            aria-label="Cambiar la meta"
            className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-primary-dark/20"
          >
            <Pencil size={16} />
          </button>
        </div>
        <p className="-mt-1 text-2xl font-bold tabular-nums text-ink">
          {done} <span className="text-base font-normal text-lavender">de {goal.target} {plural}</span>
        </p>
        <div
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-primary-dark/25"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Meta ${year}`}
        >
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 flex justify-between text-xs text-lavender">
          <span>{status}</span>
          <span className="tabular-nums">{pct}%</span>
        </p>
      </div>
      {sheet}
    </>
  )
}

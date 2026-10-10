import { useState } from 'react'
import { BookOpen, ListChecks, Pencil, Play, Square, Trophy, X } from 'lucide-react'
import { SectionCard } from '../../../components/SectionCard'
import { ProgressRing } from '../../../components/ProgressRing'
import { StarRating } from '../../../components/StarRating'
import type { Game } from '../../../types/game'
import { ElapsedTime } from './ElapsedTime'
import { inputClass } from './shared'

interface ProgressCardProps {
  game: Game
  setField: (changes: Partial<Game>, options?: { immediate?: boolean }) => void
  /** Inicio del cronómetro de este juego, si está corriendo. */
  timerStartedAt: number | null
  onStartTimer: () => void
  onStopTimer: () => void
  onCancelTimer: () => void
}

/** Progreso (historia, general, 100%), horas jugadas con el cronómetro y puntaje. */
export function ProgressCard({
  game,
  setField,
  timerStartedAt,
  onStartTimer,
  onStopTimer,
  onCancelTimer,
}: ProgressCardProps) {
  const [editingProgress, setEditingProgress] = useState(false)
  const [editingHours, setEditingHours] = useState(false)
  // Texto crudo del input de horas mientras se edita (null = mostrar el valor
  // del modelo). Sin esto, un input controlado de type="number" no deja borrar
  // el 0 ni escribir "7." como paso intermedio hacia "7.5".
  const [hoursText, setHoursText] = useState<string | null>(null)

  const storyPercent = game.story_percent ?? 0
  const generalPercent = game.general_percent ?? 0
  const completionistPercent = game.completionist_percent ?? 0

  return (
    <SectionCard
      icon={ListChecks}
      title="Progreso"
      action={
        <button
          onClick={() => setEditingProgress((v) => !v)}
          aria-label="Editar progreso"
          aria-expanded={editingProgress}
          className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-primary-dark/20"
        >
          <Pencil size={16} />
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-background/40 p-3">
        <ProgressRing icon={BookOpen} label="Historia" percent={storyPercent} />
        <ProgressRing icon={ListChecks} label="General" percent={generalPercent} />
        <ProgressRing icon={Trophy} label="100%" percent={completionistPercent} />
      </div>

      {editingProgress && (
        <div className="mt-3 flex flex-col gap-3">
          {(
            [
              ['story_percent', 'Historia', storyPercent],
              ['general_percent', 'General', generalPercent],
              ['completionist_percent', '100%', completionistPercent],
            ] as const
          ).map(([key, label, value]) => (
            <label key={key} className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-lavender">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={value}
                onChange={(e) => setField({ [key]: Number(e.target.value) })}
                className="h-8 w-full accent-accent"
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-xl bg-background/40 p-3">
        <div>
          <p className="text-2xl font-bold text-ink">{game.hours_played}</p>
          <p className="text-xs text-lavender">horas jugadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingHours((v) => !v)}
            aria-label="Editar horas"
            aria-expanded={editingHours}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
          >
            <Pencil size={16} />
          </button>
          {timerStartedAt == null && (
            <button
              onClick={onStartTimer}
              className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-primary-darker active:scale-95"
            >
              <Play size={14} fill="currentColor" /> Jugar
            </button>
          )}
        </div>
      </div>

      {timerStartedAt != null && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent/15 p-3 ring-1 ring-accent/40">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-lavender">Sesión en curso</p>
            <ElapsedTime startedAt={timerStartedAt} />
          </div>
          <button
            onClick={onCancelTimer}
            aria-label="Descartar cronómetro"
            className="flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-primary-dark/20"
          >
            <X size={18} />
          </button>
          <button
            onClick={onStopTimer}
            className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-primary-darker active:scale-95"
          >
            <Square size={14} fill="currentColor" /> Terminar
          </button>
        </div>
      )}
      {editingHours && (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          aria-label="Horas jugadas"
          value={hoursText ?? String(game.hours_played ?? 0)}
          onChange={(e) => {
            const raw = e.target.value
            setHoursText(raw)
            const parsed = raw === '' ? 0 : Number(raw)
            if (!Number.isNaN(parsed)) {
              setField({ hours_played: parsed })
            }
          }}
          onBlur={() => setHoursText(null)}
          className={`mt-2 ${inputClass}`}
        />
      )}

      <div className="mt-3">
        <StarRating
          value={game.rating ?? null}
          onChange={(rating) => setField({ rating }, { immediate: true })}
        />
      </div>
    </SectionCard>
  )
}

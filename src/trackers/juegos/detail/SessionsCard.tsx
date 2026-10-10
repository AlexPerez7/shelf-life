import { useState } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { SectionCard } from '../../../components/SectionCard'
import { Chip } from '../../../components/Chip'
import { formatDate, todayISO } from '../../../lib/dates'
import type { PlaySession } from '../../../types/game'
import { inputClass } from './shared'

/** Duraciones rápidas para registrar una sesión sin teclear. */
const QUICK_MINUTES = [15, 30, 45, 60, 90, 120]

interface SessionsCardProps {
  sessions: PlaySession[]
  /** Registra una sesión a mano; devuelve si se guardó. */
  onAdd: (minutes: number, day: string) => Promise<boolean>
  onDelete: (session: PlaySession) => void
}

/** Registrar sesiones a mano (minutos y día) y la lista de las registradas. */
export function SessionsCard({ sessions, onAdd, onDelete }: SessionsCardProps) {
  const [sessionMinutes, setSessionMinutes] = useState('')
  const [sessionDate, setSessionDate] = useState(todayISO())
  const [sessionError, setSessionError] = useState<string | null>(null)

  async function handleAdd() {
    const minutes = Number(sessionMinutes)
    if (!minutes || minutes <= 0) {
      setSessionError('Ingresa una duración válida en minutos')
      return
    }
    setSessionError(null)
    if (await onAdd(minutes, sessionDate)) setSessionMinutes('')
  }

  return (
    <SectionCard icon={Clock} title="Sesiones de juego">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {QUICK_MINUTES.map((m) => (
            <Chip
              key={m}
              active={sessionMinutes === String(m)}
              onClick={() => setSessionMinutes(String(m))}
              inactiveClassName="bg-background/40 text-lavender ring-1 ring-primary-dark/30"
            >
              {m < 60 ? `${m} min` : `${m / 60} h`}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Minutos"
            aria-label="Minutos jugados"
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(e.target.value)}
            className={`min-w-0 ${inputClass}`}
          />
          <input
            type="date"
            aria-label="Fecha de la sesión"
            value={sessionDate}
            max={todayISO()}
            onChange={(e) => setSessionDate(e.target.value)}
            className={`min-w-0 ${inputClass}`}
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!sessionMinutes}
          className="min-h-11 rounded-xl bg-primary text-sm font-semibold text-white disabled:opacity-40"
        >
          Registrar sesión
        </button>
      </div>
      {sessionError && <p className="mb-2 text-sm text-error">{sessionError}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-lavender">Todavía no registraste sesiones.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-background/40 py-1 pl-3 pr-1 text-sm ring-1 ring-primary-dark/30"
            >
              <span className="text-lavender">
                {formatDate(s.played_at)} — {s.duration_minutes} min
              </span>
              <button
                onClick={() => onDelete(s)}
                aria-label={`Eliminar sesión de ${s.duration_minutes} min`}
                className="flex h-10 w-10 items-center justify-center rounded-full text-lavender active:bg-error/10 active:text-error"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

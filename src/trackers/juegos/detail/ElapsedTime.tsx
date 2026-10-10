import { formatElapsed, useNow } from '../../../contexts/SessionTimerContext'

/** Tiempo del cronómetro: cambia cada segundo, así que va solo (no redibuja el detalle entero). */
export function ElapsedTime({ startedAt }: { startedAt: number }) {
  const now = useNow(true)
  return (
    <p className="text-2xl font-bold tabular-nums text-ink" aria-live="off">
      {formatElapsed(now - startedAt)}
    </p>
  )
}

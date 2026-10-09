import { Link, useLocation } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { formatElapsed, useNow, useSessionTimer } from '../contexts/SessionTimerContext'
import { gamesPaths } from '../trackers/juegos/paths'

/**
 * Píldora flotante sobre la barra inferior mientras hay un cronómetro
 * corriendo: recuerda que se está midiendo una sesión y lleva al juego.
 * No se muestra en el detalle de ese juego (ahí ya está el cronómetro).
 */
export function TimerBanner() {
  const { timer } = useSessionTimer()
  const location = useLocation()
  const now = useNow(timer != null)

  if (!timer || location.pathname === gamesPaths.game(timer.gameId)) return null

  return (
    <Link
      to={gamesPaths.game(timer.gameId)}
      className="toast-in fixed left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-primary-darker shadow-lg shadow-black/40"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom))' }}
    >
      <Timer size={16} className="flex-shrink-0 animate-pulse" />
      <span className="truncate">{timer.title}</span>
      <span className="flex-shrink-0 tabular-nums">{formatElapsed(now - timer.startedAt)}</span>
    </Link>
  )
}

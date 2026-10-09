import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Timer } from 'lucide-react'
import { mediaSections } from '../lib/media'
import { formatElapsed, useNow, useSessionTimer } from '../contexts/SessionTimerContext'
import { gamesPaths } from '../trackers/juegos/paths'

/**
 * Píldora flotante sobre la barra inferior mientras hay un cronómetro
 * corriendo: recuerda que se está midiendo una sesión (de juego o de
 * lectura) y lleva a su detalle, donde no se muestra (ahí ya está).
 */
export function TimerBanner() {
  const { timer } = useSessionTimer()
  const location = useLocation()
  const now = useNow(timer != null)

  if (!timer) return null
  const isBook = timer.kind === 'book'
  const to = isBook ? mediaSections.libros.detailPath(timer.gameId) : gamesPaths.game(timer.gameId)
  if (location.pathname === to) return null
  const Icon = isBook ? BookOpen : Timer

  return (
    <Link
      to={to}
      className="toast-in fixed left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-primary-darker shadow-lg shadow-black/40"
      style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom))' }}
    >
      <Icon size={16} className="flex-shrink-0 animate-pulse" />
      <span className="truncate">{timer.title}</span>
      <span className="flex-shrink-0 tabular-nums">{formatElapsed(now - timer.startedAt)}</span>
    </Link>
  )
}

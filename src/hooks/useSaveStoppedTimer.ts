import { useCallback } from 'react'
import { useGames } from './useGames'
import { useMedia } from '../contexts/MediaContext'
import type { useSessionTimer } from '../contexts/SessionTimerContext'

type Stopped = NonNullable<ReturnType<ReturnType<typeof useSessionTimer>['stop']>>

/**
 * Guarda el tiempo de un cronómetro detenido en su ítem, sea juego (sesión)
 * o libro (minutos de lectura, sin cambiar la página). Para cuando se
 * empieza otro y hay que cerrar el que estaba corriendo. Funciona sin
 * conexión: los dos pasan por la cola de cambios pendientes.
 */
export function useSaveStoppedTimer() {
  const { logSession } = useGames()
  const { logActivity } = useMedia()

  return useCallback(
    async (stopped: Stopped) => {
      if (stopped.kind === 'book') {
        await logActivity(stopped.gameId, { duration_minutes: stopped.minutes }, {})
        return
      }
      // Sesión de juego: como cualquier otra, con cola sin conexión.
      await logSession(stopped.gameId, {
        minutes: stopped.minutes,
        playedAt: new Date(stopped.startedAt).toISOString(),
      })
    },
    [logSession, logActivity]
  )
}

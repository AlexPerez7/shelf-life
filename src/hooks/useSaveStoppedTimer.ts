import { useCallback } from 'react'
import { useGames } from './useGames'
import { useMedia } from '../contexts/MediaContext'
import { ensureSession, supabase } from '../lib/supabaseClient'
import type { useSessionTimer } from '../contexts/SessionTimerContext'

type Stopped = NonNullable<ReturnType<ReturnType<typeof useSessionTimer>['stop']>>

/**
 * Guarda el tiempo de un cronómetro detenido en su ítem, sea juego (sesión)
 * o libro (minutos de lectura, sin cambiar la página). Para cuando se
 * empieza otro y hay que cerrar el que estaba corriendo.
 */
export function useSaveStoppedTimer() {
  const { refreshGame } = useGames()
  const { logActivity } = useMedia()

  return useCallback(
    async (stopped: Stopped) => {
      if (stopped.kind === 'book') {
        await logActivity(stopped.gameId, { duration_minutes: stopped.minutes }, {})
        return
      }
      await ensureSession()
      const { error } = await supabase.from('activity_log').insert({
        item_id: stopped.gameId,
        duration_minutes: stopped.minutes,
        occurred_at: new Date(stopped.startedAt).toISOString(),
      })
      if (error) throw error
      await refreshGame(stopped.gameId)
    },
    [refreshGame, logActivity]
  )
}

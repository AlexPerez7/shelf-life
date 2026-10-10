import { useCallback, useEffect, useState } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { useGames } from './useGames'
import type { PlaySession } from '../types/game'

// Las sesiones viven en `activity_log` (genérica para todos los tipos de
// medio); los alias devuelven la forma de PlaySession que usa la UI.
const SESSION_COLUMNS =
  'id, game_id:item_id, duration_minutes, played_at:occurred_at, notes'

const byDateDesc = (x: PlaySession, y: PlaySession) =>
  new Date(y.played_at).getTime() - new Date(x.played_at).getTime()

/**
 * Sesiones de un juego. Registrar una pasa por `logSession` de GamesContext
 * (optimista, con cola sin conexión); la lista suma las que todavía esperan
 * en la cola, así se ven aunque se haya cerrado la app sin señal.
 */
export function usePlaySessions(gameId: string | undefined) {
  const { logSession, pendingSessions, cancelPendingSession } = useGames()
  const [saved, setSaved] = useState<PlaySession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    if (!gameId) return
    setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('activity_log')
      .select(SESSION_COLUMNS)
      .eq('item_id', gameId)
      .order('occurred_at', { ascending: false })

    if (!error) setSaved(data as PlaySession[])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const addSession = useCallback(
    async (durationMinutes: number, playedAt: string, notes?: string) => {
      if (!gameId) return
      const session = await logSession(gameId, { minutes: durationMinutes, playedAt, notes })
      // Mantener el orden por fecha (una sesión con fecha pasada, o restaurada
      // con "Deshacer", no va necesariamente primera).
      setSaved((prev) => [session, ...prev.filter((s) => s.id !== session.id)].sort(byDateDesc))
      return session
    },
    [gameId, logSession]
  )

  /**
   * Una sesión que todavía no se guardó solo sale de la cola; si no, se borra
   * en la base. Devuelve si estaba en la cola (entonces no hace falta releer el juego).
   */
  const deleteSession = useCallback(
    async (id: string) => {
      const wasPending = cancelPendingSession(id)
      if (!wasPending) {
        const { error } = await supabase.from('activity_log').delete().eq('id', id)
        if (error) throw error
      }
      setSaved((prev) => prev.filter((s) => s.id !== id))
      return wasPending
    },
    [cancelPendingSession]
  )

  // Se calcula en cada render: la cola cambia sin cambiar `saved` (y el
  // contexto vuelve a renderizar cuando cambia).
  const pending = gameId ? pendingSessions(gameId).filter((p) => !saved.some((s) => s.id === p.id)) : []
  const sessions = pending.length ? [...pending, ...saved].sort(byDateDesc) : saved

  /** ¿Esta sesión todavía espera en la cola? (para marcarla en la lista). */
  const isPending = useCallback(
    (id: string) => !!gameId && pendingSessions(gameId).some((p) => p.id === id),
    [gameId, pendingSessions]
  )

  return { sessions, loading, addSession, deleteSession, isPending, refetch: fetchSessions }
}

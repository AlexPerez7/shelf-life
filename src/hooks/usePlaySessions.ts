import { useCallback, useEffect, useState } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import type { PlaySession } from '../types/game'

// Las sesiones viven en `activity_log` (genérica para todos los tipos de
// medio); los alias devuelven la forma de PlaySession que usa la UI.
const SESSION_COLUMNS =
  'id, game_id:item_id, duration_minutes, played_at:occurred_at, notes'

export function usePlaySessions(gameId: string | undefined) {
  const [sessions, setSessions] = useState<PlaySession[]>([])
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

    if (!error) setSessions(data as PlaySession[])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const addSession = useCallback(
    async (durationMinutes: number, playedAt: string, notes?: string) => {
      if (!gameId) return
      const { data, error } = await supabase
        .from('activity_log')
        .insert({
          item_id: gameId,
          duration_minutes: durationMinutes,
          occurred_at: playedAt,
          notes: notes || null,
        })
        .select(SESSION_COLUMNS)
        .single()

      if (error) throw error
      // Mantener el orden por fecha (una sesión con fecha pasada, o restaurada
      // con "Deshacer", no va necesariamente primera).
      setSessions((prev) =>
        [data as PlaySession, ...prev].sort(
          (x, y) => new Date(y.played_at).getTime() - new Date(x.played_at).getTime()
        )
      )
      return data as PlaySession
    },
    [gameId]
  )

  const deleteSession = useCallback(async (id: string) => {
    const { error } = await supabase.from('activity_log').delete().eq('id', id)
    if (error) throw error
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return { sessions, loading, addSession, deleteSession, refetch: fetchSessions }
}

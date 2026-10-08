import { useCallback, useEffect, useState } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'

// La lista de listas se comparte a nivel de app (ver ListsProvider).
export { useLists } from '../contexts/ListsContext'

export function useGameListIds(gameId: string | undefined) {
  const [listIds, setListIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchListIds = useCallback(async () => {
    if (!gameId) return
    setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('list_id')
      .eq('item_id', gameId)

    if (!error) setListIds(new Set(data.map((row) => row.list_id as string)))
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchListIds()
  }, [fetchListIds])

  const toggle = useCallback(
    async (listId: string) => {
      if (!gameId) return
      if (listIds.has(listId)) {
        const { error } = await supabase
          .from('list_items')
          .delete()
          .eq('list_id', listId)
          .eq('item_id', gameId)
        if (error) throw error
        setListIds((prev) => {
          const next = new Set(prev)
          next.delete(listId)
          return next
        })
      } else {
        const { error } = await supabase
          .from('list_items')
          .insert({ list_id: listId, item_id: gameId })
        if (error) throw error
        setListIds((prev) => new Set(prev).add(listId))
      }
    },
    [gameId, listIds]
  )

  return { listIds, loading, toggle }
}

export function useListGameIds(listId: string | undefined) {
  const [gameIds, setGameIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGameIds = useCallback(async () => {
    if (!listId) return
    setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('list_items')
      .select('item_id')
      .eq('list_id', listId)
      .order('added_at', { ascending: false })

    if (!error) setGameIds(data.map((row) => row.item_id as string))
    setLoading(false)
  }, [listId])

  useEffect(() => {
    fetchGameIds()
  }, [fetchGameIds])

  const removeGame = useCallback(
    async (gameId: string) => {
      if (!listId) return
      const { error } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', listId)
        .eq('item_id', gameId)
      if (error) throw error
      setGameIds((prev) => prev.filter((id) => id !== gameId))
    },
    [listId]
  )

  /** Vuelve a agregar un juego quitado (para "Deshacer"), en su posición. */
  const restoreGame = useCallback(
    async (gameId: string, index: number) => {
      if (!listId) return
      const { error } = await supabase
        .from('list_items')
        .insert({ list_id: listId, item_id: gameId })
      if (error) throw error
      setGameIds((prev) => {
        if (prev.includes(gameId)) return prev
        const next = [...prev]
        next.splice(Math.min(index, next.length), 0, gameId)
        return next
      })
    },
    [listId]
  )

  return { gameIds, loading, removeGame, restoreGame }
}

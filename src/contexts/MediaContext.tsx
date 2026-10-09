import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { readCache, removeCacheByPrefix, writeCache } from '../lib/localCache'
import type { Item, ItemWrite } from '../types/item'

interface Activity {
  duration_minutes?: number | null
  progress_delta?: number | null
}

interface MediaContextValue {
  /** Todo lo que no es juego (películas, series, anime; después libros). */
  items: Item[]
  loading: boolean
  error: string | null
  addItem: (item: ItemWrite & Pick<Item, 'media_type' | 'title'>) => Promise<Item>
  updateItem: (id: string, changes: ItemWrite) => Promise<Item>
  deleteItem: (id: string) => Promise<void>
  /**
   * Registra actividad (película vista, episodios) en `activity_log` y aplica
   * `changes` al ítem. El tiempo invertido lo suma el trigger de la DB; el
   * update posterior devuelve la fila ya con ese tiempo.
   */
  logActivity: (id: string, activity: Activity, changes: ItemWrite) => Promise<Item>
}

const MediaContext = createContext<MediaContextValue | null>(null)

const CACHE_PREFIX = 'playdex_media_v1:'

/**
 * Biblioteca de las secciones que no son juegos. Mismo esquema que
 * GamesProvider: cache local para pintar al instante y revalidación contra la
 * DB al iniciar sesión.
 */
export function MediaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const userIdRef = useRef<string | null>(null)

  const fetchItems = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .neq('media_type', 'game')
      .order('created_at', { ascending: false })

    if (error) {
      if (!hasLoaded.current) setError(error.message)
    } else {
      setItems(data as Item[])
      setError(null)
      hasLoaded.current = true
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Ver GamesProvider: mismos eventos y mismas razones.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        hasLoaded.current = false
        userIdRef.current = null
        removeCacheByPrefix(CACHE_PREFIX)
        setItems([])
        setError(null)
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (userIdRef.current !== session.user.id) {
          userIdRef.current = session.user.id
          const cached = readCache<Item[]>(CACHE_PREFIX + session.user.id)
          if (cached) {
            setItems(cached.data)
            setLoading(false)
            hasLoaded.current = true
          }
        }
        setTimeout(fetchItems, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchItems])

  useEffect(() => {
    if (hasLoaded.current && userIdRef.current) {
      writeCache(CACHE_PREFIX + userIdRef.current, items)
    }
  }, [items])

  const addItem = useCallback<MediaContextValue['addItem']>(async (item) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const { data, error } = await supabase
      .from('items')
      .insert({ ...item, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setItems((prev) => [data as Item, ...prev])
    return data as Item
  }, [])

  const updateItem = useCallback<MediaContextValue['updateItem']>(async (id, changes) => {
    const { data, error } = await supabase
      .from('items')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setItems((prev) => prev.map((i) => (i.id === id ? (data as Item) : i)))
    return data as Item
  }, [])

  const deleteItem = useCallback<MediaContextValue['deleteItem']>(async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const logActivity = useCallback<MediaContextValue['logActivity']>(
    async (id, activity, changes) => {
      const { error } = await supabase.from('activity_log').insert({
        item_id: id,
        duration_minutes: activity.duration_minutes || null,
        progress_delta: activity.progress_delta ?? null,
      })
      if (error) throw error
      // Aunque no haya cambios propios, el select trae el tiempo actualizado.
      const { data, error: updateError } =
        Object.keys(changes).length > 0
          ? await supabase.from('items').update(changes).eq('id', id).select().single()
          : await supabase.from('items').select('*').eq('id', id).single()
      if (updateError) throw updateError
      setItems((prev) => prev.map((i) => (i.id === id ? (data as Item) : i)))
      return data as Item
    },
    []
  )

  const value = useMemo<MediaContextValue>(
    () => ({ items, loading, error, addItem, updateItem, deleteItem, logActivity }),
    [items, loading, error, addItem, updateItem, deleteItem, logActivity]
  )

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
}

export function useMedia() {
  const ctx = useContext(MediaContext)
  if (!ctx) throw new Error('useMedia debe usarse dentro de <MediaProvider>')
  return ctx
}

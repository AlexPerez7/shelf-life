import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { readCache, removeCacheByPrefix, writeCache } from '../lib/localCache'
import { usePendingSync } from '../hooks/usePendingSync'
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
  /**
   * Alta en lote (importaciones): un insert cada 200, avisando el avance.
   * Acepta `created_at` para conservar la fecha en que se agregó en otra app.
   */
  addItems: (
    items: (ItemWrite & Pick<Item, 'media_type' | 'title'> & { created_at?: string })[],
    onProgress?: (done: number) => void
  ) => Promise<Item[]>
  updateItem: (id: string, changes: ItemWrite) => Promise<Item>
  deleteItem: (id: string) => Promise<void>
  /**
   * Registra actividad (película vista, episodios) en `activity_log` y aplica
   * `changes` al ítem. El tiempo invertido lo suma el trigger de la DB; el
   * update posterior devuelve la fila ya con ese tiempo.
   */
  logActivity: (id: string, activity: Activity, changes: ItemWrite) => Promise<Item>
  /** Cambios hechos sin conexión que todavía no llegaron a la base. */
  pendingCount: number
  /** Un cambio pendiente que la base rechazó al reintentar. */
  syncError: { message: string; at: number } | null
  /** Intenta mandar ya lo pendiente; devuelve cuántos cambios quedan. */
  flushPending: () => Promise<number>
  /** Descarta lo pendiente (al cerrar sesión). */
  discardPending: () => void
}

const MediaContext = createContext<MediaContextValue | null>(null)

const CACHE_PREFIX = 'shelflife_media_v1:'

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
  // Estado actual, para tener el "antes" de un cambio optimista.
  const itemsRef = useRef<Item[]>([])
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  const sync = usePendingSync('media', setItems, itemsRef)
  const { overlay, setUser } = sync

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
      // Lo hecho sin conexión que todavía no llegó se sigue viendo.
      setItems(overlay(data as Item[]))
      setError(null)
      hasLoaded.current = true
    }
    setLoading(false)
  }, [overlay])

  useEffect(() => {
    // Ver GamesProvider: mismos eventos y mismas razones.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        hasLoaded.current = false
        userIdRef.current = null
        setUser(null)
        removeCacheByPrefix(CACHE_PREFIX)
        setItems([])
        setError(null)
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (userIdRef.current !== session.user.id) {
          userIdRef.current = session.user.id
          setUser(session.user.id)
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
  }, [fetchItems, setUser])

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

  const addItems = useCallback<MediaContextValue['addItems']>(async (newItems, onProgress) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('No hay sesión activa')

    const created: Item[] = []
    for (let i = 0; i < newItems.length; i += 200) {
      const rows = newItems.slice(i, i + 200).map((item) => ({ ...item, user_id: user.id }))
      const { data, error } = await supabase.from('items').insert(rows).select()
      if (error) throw error
      created.push(...(data as Item[]))
      // Por tandas, para que se vea el avance.
      setItems((prev) => [...(data as Item[]), ...prev])
      onProgress?.(created.length)
    }
    return created
  }, [])

  const { save, dropItem } = sync
  /**
   * Optimista: el cambio se ve al instante y se guarda en segundo plano (la
   * ida y vuelta a Supabase en el teléfono puede tardar segundos). Sin
   * conexión queda en la cola de cambios pendientes.
   */
  const updateItem = useCallback<MediaContextValue['updateItem']>(
    (id, changes) => save({ type: 'update', itemId: id, changes }, (i) => ({ ...i, ...changes }) as Item),
    [save]
  )

  const deleteItem = useCallback<MediaContextValue['deleteItem']>(async (id) => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    dropItem(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [dropItem])

  /**
   * También optimista: el avance (y el tiempo, que en la base suma un
   * trigger) se ve al instante; el registro y el cambio se guardan en fila,
   * o en la cola si no hay conexión.
   */
  const logActivity = useCallback<MediaContextValue['logActivity']>(
    (id, activity, changes) =>
      save(
        {
          type: 'activity',
          itemId: id,
          activity: {
            id: crypto.randomUUID(),
            duration_minutes: activity.duration_minutes || null,
            progress_delta: activity.progress_delta ?? null,
            occurred_at: new Date().toISOString(),
          },
          changes,
        },
        (i) =>
          ({
            ...i,
            ...changes,
            time_spent_minutes: i.time_spent_minutes + (activity.duration_minutes || 0),
          }) as Item
      ),
    [save]
  )

  const { pendingCount, syncError, flush, discard } = sync
  const value = useMemo<MediaContextValue>(
    () => ({
      items,
      loading,
      error,
      addItem,
      addItems,
      updateItem,
      deleteItem,
      logActivity,
      pendingCount,
      syncError,
      flushPending: flush,
      discardPending: discard,
    }),
    [items, loading, error, addItem, addItems, updateItem, deleteItem, logActivity, pendingCount, syncError, flush, discard]
  )

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
}

export function useMedia() {
  const ctx = useContext(MediaContext)
  if (!ctx) throw new Error('useMedia debe usarse dentro de <MediaProvider>')
  return ctx
}

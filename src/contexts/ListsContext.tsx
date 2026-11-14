import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, ensureSession } from '../lib/supabaseClient'
import { readCache, removeCacheByPrefix, writeCache } from '../lib/localCache'
import { useListsQueue } from '../hooks/useListsQueue'
import { LISTS_CACHE_PREFIX, overlayLists, type ListOp } from '../lib/pendingLists'
import type { GameList } from '../types/game'

interface ListsContextValue {
  lists: GameList[]
  loading: boolean
  createList: (name: string) => Promise<GameList>
  deleteList: (id: string) => Promise<void>
  updateList: (id: string, changes: Partial<Pick<GameList, 'name' | 'is_public'>>) => Promise<GameList>
  refetch: () => Promise<void>
  /** Usuario con la sesión abierta (dueño de las listas en memoria). */
  userId: string | null
  /** Manda un cambio de una lista o de sus títulos (con cola sin conexión). Ver `useListsQueue`. */
  mutate: (op: ListOp) => Promise<void>
  /** Lo que espera en la cola, para ponerlo encima de lo que trae la base. */
  pendingOps: () => ListOp[]
  /** Sube cuando la base rechaza un cambio pendiente: las pantallas releen. */
  rejectedCount: number
  /** Cambios hechos sin conexión que todavía no llegaron a la base. */
  pendingCount: number
  syncError: { message: string; at: number } | null
  /** Intenta mandar ya lo pendiente; devuelve cuántos cambios quedan. */
  flushPending: () => Promise<number>
  /** Descarta lo pendiente (al cerrar sesión). */
  discardPending: () => void
}

const ListsContext = createContext<ListsContextValue | null>(null)

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<GameList[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const hasLoaded = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const queue = useListsQueue()
  const { mutate, setUser, ops: pendingOps, rejected, pendingCount, syncError, flush, discard } = queue

  const fetchLists = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    await ensureSession()
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      // Lo hecho sin conexión que todavía no llegó se sigue viendo.
      setLists(overlayLists(data as GameList[], pendingOps()))
      hasLoaded.current = true
    }
    setLoading(false)
  }, [pendingOps])

  useEffect(() => {
    // Mismo criterio que GamesContext: solo recargar en login/sesión inicial,
    // no en cada renovación de token (que en mobile ocurre al volver del
    // segundo plano).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        hasLoaded.current = false
        userIdRef.current = null
        setUserId(null)
        setUser(null)
        removeCacheByPrefix(LISTS_CACHE_PREFIX)
        setLists([])
        setLoading(false)
        return
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (userIdRef.current !== session.user.id) {
          userIdRef.current = session.user.id
          setUserId(session.user.id)
          setUser(session.user.id)
          const cached = readCache<GameList[]>(`${LISTS_CACHE_PREFIX}lists:${session.user.id}`)
          if (cached) {
            setLists(cached.data)
            setLoading(false)
            hasLoaded.current = true
          }
        }
        setTimeout(fetchLists, 0)
      }
    })
    return () => subscription.unsubscribe()
  }, [fetchLists, setUser])

  // Si la base rechaza un cambio pendiente, se relee para volver a lo que quedó.
  const lastRejected = useRef(rejected)
  useEffect(() => {
    if (rejected !== lastRejected.current) {
      lastRejected.current = rejected
      void fetchLists()
    }
  }, [rejected, fetchLists])

  useEffect(() => {
    if (hasLoaded.current && userIdRef.current) {
      writeCache(`${LISTS_CACHE_PREFIX}lists:${userIdRef.current}`, lists)
    }
  }, [lists])

  /** Optimista: la lista se ve al instante (con id generado acá); sin conexión queda en la cola. */
  const createList = useCallback(
    async (name: string) => {
      if (!userIdRef.current) throw new Error('No hay sesión activa')
      const now = new Date().toISOString()
      const list: GameList = {
        id: crypto.randomUUID(),
        user_id: userIdRef.current,
        name,
        is_public: false,
        created_at: now,
        updated_at: now,
      }
      setLists((prev) => [list, ...prev])
      try {
        await mutate({ type: 'create', listId: list.id, list })
      } catch (err) {
        setLists((prev) => prev.filter((l) => l.id !== list.id))
        throw err
      }
      return list
    },
    [mutate]
  )

  const deleteList = useCallback(
    async (id: string) => {
      const previous = lists
      setLists((prev) => prev.filter((l) => l.id !== id))
      try {
        await mutate({ type: 'delete', listId: id })
      } catch (err) {
        setLists(previous)
        throw err
      }
    },
    [lists, mutate]
  )

  const updateList = useCallback(
    async (id: string, changes: Partial<Pick<GameList, 'name' | 'is_public'>>) => {
      const previous = lists.find((l) => l.id === id)
      if (!previous) throw new Error('La lista ya no existe')
      const next: GameList = { ...previous, ...changes, updated_at: new Date().toISOString() }
      setLists((prev) => prev.map((l) => (l.id === id ? next : l)))
      try {
        await mutate({ type: 'update', listId: id, changes })
      } catch (err) {
        setLists((prev) => prev.map((l) => (l.id === id ? previous : l)))
        throw err
      }
      return next
    },
    [lists, mutate]
  )

  const value = useMemo<ListsContextValue>(
    () => ({
      lists,
      loading,
      createList,
      deleteList,
      updateList,
      refetch: fetchLists,
      userId,
      mutate,
      pendingOps,
      rejectedCount: rejected,
      pendingCount,
      syncError,
      flushPending: flush,
      discardPending: discard,
    }),
    [
      lists,
      loading,
      createList,
      deleteList,
      updateList,
      fetchLists,
      userId,
      mutate,
      pendingOps,
      rejected,
      pendingCount,
      syncError,
      flush,
      discard,
    ]
  )

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
}

export function useLists() {
  const ctx = useContext(ListsContext)
  if (!ctx) throw new Error('useLists debe usarse dentro de <ListsProvider>')
  return ctx
}

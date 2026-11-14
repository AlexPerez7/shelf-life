import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isNetworkError } from '../lib/pendingChanges'
import { addListOp, listQueueKey, readListOps, writeListOps, type ListOp } from '../lib/pendingLists'

const RETRY_MS = 30_000

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String((err as { message?: string } | null)?.message ?? err)

/** Manda un cambio de listas a la base. Todos son idempotentes (ids generados en el dispositivo). */
async function run(op: ListOp, userId: string) {
  switch (op.type) {
    case 'create': {
      const { id, name, is_public, created_at } = op.list
      const { error } = await supabase
        .from('lists')
        .upsert({ id, name, is_public: is_public ?? false, created_at, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      return
    }
    case 'update': {
      const { error } = await supabase.from('lists').update(op.changes).eq('id', op.listId)
      if (error) throw error
      return
    }
    case 'delete': {
      const { error } = await supabase.from('lists').delete().eq('id', op.listId)
      if (error) throw error
      return
    }
    case 'add': {
      const { error } = await supabase
        .from('list_items')
        .upsert({ list_id: op.listId, item_id: op.itemId }, { onConflict: 'list_id,item_id', ignoreDuplicates: true })
      if (error) throw error
      return
    }
    case 'remove': {
      const { error } = await supabase.from('list_items').delete().eq('list_id', op.listId).eq('item_id', op.itemId)
      if (error) throw error
    }
  }
}

/**
 * Cola de cambios de las listas, con el mismo criterio que `usePendingSync`
 * (ver `lib/pendingLists.ts`): `mutate` manda el cambio ya y, sin conexión,
 * lo deja en una cola guardada en el dispositivo que se reintenta sola al
 * volver la señal, al volver la app al frente y cada 30 s.
 *
 * La pantalla muestra el cambio al instante por su cuenta (estado optimista);
 * lo pendiente se pone encima de lo que trae la base con `ops()`.
 */
export function useListsQueue() {
  const userRef = useRef<string | null>(null)
  const opsRef = useRef<ListOp[]>([])
  const inFlightRef = useRef<ListOp | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  /** Sube cada vez que la base rechaza un cambio pendiente: las pantallas releen. */
  const [rejected, setRejected] = useState(0)
  const [syncError, setSyncError] = useState<{ message: string; at: number } | null>(null)

  const persist = useCallback((ops: ListOp[]) => {
    opsRef.current = ops
    setPendingCount(ops.length)
    if (userRef.current) writeListOps(listQueueKey(userRef.current), ops)
  }, [])

  const flushing = useRef<Promise<void> | null>(null)
  const flushOnce = useCallback((): Promise<void> => {
    if (flushing.current) return flushing.current
    if (opsRef.current.length === 0 || !userRef.current || !navigator.onLine) return Promise.resolve()
    const user = userRef.current
    flushing.current = (async () => {
      while (opsRef.current.length > 0 && userRef.current === user) {
        const op = opsRef.current[0]
        inFlightRef.current = op
        try {
          await run(op, user)
          if (userRef.current !== user) break
          persist(opsRef.current.filter((o) => o !== op))
        } catch (err) {
          if (isNetworkError(err)) break
          // La base lo rechazó: se descarta y las pantallas releen lo que quedó.
          persist(opsRef.current.filter((o) => o !== op))
          setSyncError({ message: errorMessage(err), at: Date.now() })
          setRejected((n) => n + 1)
        } finally {
          inFlightRef.current = null
        }
      }
    })().finally(() => {
      flushing.current = null
    })
    return flushing.current
  }, [persist])

  const flush = useCallback(async () => {
    await flushOnce()
    return opsRef.current.length
  }, [flushOnce])

  /**
   * Manda un cambio. Si no hay nada esperando se intenta ya: lo que la base
   * rechaza sube como error (para que la pantalla lo deshaga); sin conexión
   * queda en la cola. Si ya hay cola, va detrás para respetar el orden.
   */
  // Los intentos directos van en fila: dos cambios seguidos llegan a la base en el mismo orden.
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const mutate = useCallback(
    (op: ListOp): Promise<void> => {
      const task = async () => {
        const user = userRef.current
        if (!user) throw new Error('No hay sesión activa')
        if (opsRef.current.length === 0 && !flushing.current) {
          try {
            await run(op, user)
            return
          } catch (err) {
            if (!isNetworkError(err)) throw err
          }
        }
        persist(addListOp(opsRef.current, op, inFlightRef.current))
        void flush()
      }
      const next = chain.current.catch(() => {}).then(task)
      chain.current = next
      return next
    },
    [flush, persist]
  )

  /** Usuario dueño de la cola (al iniciar sesión; `null` al cerrarla). */
  const setUser = useCallback(
    (userId: string | null) => {
      if (userRef.current === userId) return
      userRef.current = userId
      opsRef.current = userId ? readListOps(listQueueKey(userId)) : []
      setPendingCount(opsRef.current.length)
      if (userId) setTimeout(() => void flush(), 0)
    },
    [flush]
  )

  /** Lo pendiente, para ponerlo encima de lo que trae la base. */
  const ops = useCallback(() => opsRef.current, [])

  /** Descarta todo lo pendiente (al cerrar sesión, si el usuario lo acepta). */
  const discard = useCallback(() => persist([]), [persist])

  useEffect(() => {
    const retry = () => void flush()
    const onVisible = () => document.visibilityState === 'visible' && retry()
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])
  useEffect(() => {
    if (pendingCount === 0) return
    const timer = setInterval(() => void flush(), RETRY_MS)
    return () => clearInterval(timer)
  }, [pendingCount, flush])

  return { mutate, flush, setUser, ops, discard, pendingCount, syncError, rejected }
}

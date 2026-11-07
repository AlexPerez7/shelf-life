// Cambios sin guardar: lo que se hizo sin conexión (o con la red caída) queda
// en una cola por usuario, guardada en el dispositivo, y se manda a Supabase
// cuando vuelve la señal. Mientras tanto la app muestra los cambios igual.
//
// Reglas:
//   - Los cambios de un mismo ítem se aplican en el orden en que se hicieron.
//     Si un ítem tiene algo en la cola, lo nuevo va detrás aunque haya señal.
//   - Dos ediciones seguidas del mismo ítem se juntan en una (la segunda pisa
//     los campos que repite), salvo que la primera ya se esté mandando.
//   - Cada actividad (episodio, páginas, sesión) lleva su propio id, generado
//     acá: si se reintenta después de que la base ya la guardó, no se duplica
//     (ni se vuelve a sumar su tiempo).
//   - Un título agregado sin conexión también lleva su id desde el principio
//     (`create`), así se puede abrir, editar y registrar avance antes de que
//     llegue a la base; reintentar el alta no lo duplica.
//   - Borrar (`delete`) o mandar a la papelera un título también queda en la
//     cola. Si el título se agregó sin conexión y todavía no salió, agregarlo
//     y borrarlo se cancelan entre sí y no tocan la base.

import type { Item, ItemWrite } from '../types/item'

export interface PendingActivity {
  /** Id de la fila de `activity_log`, generado en el dispositivo. */
  id: string
  duration_minutes: number | null
  progress_delta: number | null
  /** Cuándo pasó (no cuándo se guardó). */
  occurred_at: string
  /** Nota de la sesión (juegos), si tiene. */
  notes?: string | null
}

export type PendingOp =
  | { type: 'update'; itemId: string; changes: ItemWrite }
  | { type: 'activity'; itemId: string; activity: PendingActivity; changes: ItemWrite }
  /** Un título nuevo, con el id y los valores con los que ya se está mostrando. */
  | { type: 'create'; itemId: string; item: Item }
  /** Borrar para siempre, o mandar a la papelera (`trash`, con `deletedAt`); `item` es lo que se veía, para poder deshacer. */
  | { type: 'delete'; itemId: string; trash: boolean; deletedAt: string; item: Item }

/** Fila de un título nuevo, con los valores por defecto de la base (para mostrarlo antes de que se guarde). */
export function newItem(
  write: ItemWrite & Pick<Item, 'media_type' | 'title'>,
  userId: string,
  id: string = crypto.randomUUID(),
  now: string = new Date().toISOString()
): Item {
  return {
    status: 'planned',
    rating: null,
    cover_url: null,
    genres: [],
    summary: null,
    release_date: null,
    notes: null,
    review: null,
    date_started: null,
    date_finished: null,
    time_spent_minutes: 0,
    progress: 0,
    progress_total: null,
    source: null,
    external_id: null,
    metadata: {},
    is_favorite: false,
    format: null,
    replays: 0,
    franchise: null,
    created_at: now,
    ...write,
    id,
    user_id: userId,
    updated_at: now,
  }
}

export const pendingFor = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId === itemId)

export const withoutItem = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId !== itemId)

/** Las actividades de un ítem que todavía no llegaron a la base. */
export const pendingActivities = (ops: PendingOp[], itemId: string) =>
  ops.flatMap((o) => (o.type === 'activity' && o.itemId === itemId ? [o.activity] : []))

/** Los campos que cambiaron los cambios pendientes de un ítem (el último valor de cada uno). */
export const pendingFields = (ops: PendingOp[], itemId: string): ItemWrite =>
  ops.reduce<ItemWrite>(
    (acc, o) => (o.itemId === itemId && (o.type === 'update' || o.type === 'activity') ? { ...acc, ...o.changes } : acc),
    {}
  )

/** La papelera de un título que todavía no llegó a la base (para deshacer sin conexión). */
export const pendingTrash = (ops: PendingOp[], itemId: string) =>
  ops.find((o): o is Extract<PendingOp, { type: 'delete' }> => o.type === 'delete' && o.trash && o.itemId === itemId)

/**
 * Suma un cambio al final de la cola. Una edición se junta con la anterior
 * del mismo ítem si esa también es una edición y es lo último del ítem (y no
 * es `inFlight`, la que se está mandando en este momento).
 */
export function addPendingOp(ops: PendingOp[], op: PendingOp, inFlight?: PendingOp | null): PendingOp[] {
  if (op.type === 'update') {
    for (let i = ops.length - 1; i >= 0; i--) {
      const prev = ops[i]
      if (prev.itemId !== op.itemId) continue
      if (prev.type === 'update' && prev !== inFlight) {
        const merged: PendingOp = { ...prev, changes: { ...prev.changes, ...op.changes } }
        return [...ops.slice(0, i), merged, ...ops.slice(i + 1)]
      }
      break
    }
  }
  return [...ops, op]
}

/** El ítem como queda con sus cambios pendientes (para mostrarlo así mientras tanto). */
export function applyPendingOps(item: Item, ops: PendingOp[]): Item {
  let out = item
  for (const op of ops) {
    if (op.itemId !== item.id || (op.type !== 'update' && op.type !== 'activity')) continue
    out = { ...out, ...op.changes } as Item
    if (op.type === 'activity' && op.activity.duration_minutes) {
      // En la base el tiempo lo suma un trigger al guardar la actividad.
      out = { ...out, time_spent_minutes: out.time_spent_minutes + op.activity.duration_minutes }
    }
  }
  return out
}

/**
 * Lo que trae la base, con los cambios que todavía no llegaron encima: lo
 * editado, lo agregado (los más nuevos primero) y sin lo que se borró.
 */
export function overlayPending(items: Item[], ops: PendingOp[]): Item[] {
  if (ops.length === 0) return items
  const ids = new Set(ops.map((o) => o.itemId))
  const deleted = new Set(ops.filter((o) => o.type === 'delete').map((o) => o.itemId))
  const known = new Set(items.map((i) => i.id))
  const created = ops
    .flatMap((o) => (o.type === 'create' && !known.has(o.itemId) && !deleted.has(o.itemId) ? [o.item] : []))
    .map((i) => applyPendingOps(i, ops))
    .reverse()
  const base = items.filter((i) => !deleted.has(i.id)).map((i) => (ids.has(i.id) ? applyPendingOps(i, ops) : i))
  return [...created, ...base]
}

/**
 * ¿El error es por falta de conexión (y conviene reintentar), o la base
 * rechazó el cambio? supabase-js no lanza: devuelve el error del `fetch`
 * como mensaje ("Failed to fetch" en Chrome, "Load failed" en Safari...).
 */
export function isNetworkError(err: unknown, online = typeof navigator === 'undefined' || navigator.onLine) {
  if (!online) return true
  const message =
    err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : ''
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|network error/i.test(message)
}

// ---------------------------------------------------------------------------
// Guardado en el dispositivo
// ---------------------------------------------------------------------------

export const pendingKey = (scope: string, userId: string) => `shelflife_pending_v1:${scope}:${userId}`

function isOp(value: unknown): value is PendingOp {
  if (typeof value !== 'object' || value == null) return false
  const op = value as Record<string, unknown>
  if (typeof op.itemId !== 'string') return false
  if (op.type === 'create' || op.type === 'delete') {
    const item = op.item as Record<string, unknown> | undefined
    if (typeof item?.id !== 'string' || item.id !== op.itemId) return false
    return op.type === 'create' || (typeof op.trash === 'boolean' && typeof op.deletedAt === 'string')
  }
  if (typeof op.changes !== 'object' || op.changes == null) return false
  if (op.type === 'update') return true
  const a = op.activity as Record<string, unknown> | undefined
  return op.type === 'activity' && typeof a?.id === 'string' && typeof a.occurred_at === 'string'
}

export function readPending(key: string): PendingOp[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isOp) : []
  } catch {
    return []
  }
}

export function writePending(key: string, ops: PendingOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(ops))
  } catch {
    /* sin espacio o sin acceso: la cola queda solo en memoria */
  }
}

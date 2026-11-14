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
//   - Un título nuevo también lleva su id generado acá, así se puede editar
//     (y registrar avance) sin conexión antes de que exista en la base. Si se
//     borra antes de guardarse, desaparece de la cola sin tocar la base.

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

/** Fila de un título nuevo, completa: se ve así hasta que la base la guarda. */
export type NewItemRow = ItemWrite & Pick<Item, 'media_type' | 'title'> & { created_at?: string }

export type PendingOp =
  | { type: 'update'; itemId: string; changes: ItemWrite }
  | { type: 'activity'; itemId: string; activity: PendingActivity; changes: ItemWrite }
  | { type: 'insert'; itemId: string; userId: string; row: NewItemRow & { created_at: string }; changes: ItemWrite }
  /** Borrar una sesión que ya está en la base; `minutes` es su tiempo (lo descuenta un trigger allá). */
  | { type: 'deleteActivity'; itemId: string; activityId: string; minutes: number; changes: ItemWrite }
  /** Borrado para siempre. */
  | { type: 'delete'; itemId: string; changes: ItemWrite }
  /** Borrado blando (papelera de Libros): `items.deleted_at`. */
  | { type: 'trash'; itemId: string; deletedAt: string; changes: ItemWrite }

/** Los valores que la base pone sola a un título nuevo (ver la migración 0011). */
const ITEM_DEFAULTS = {
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
} satisfies Partial<Item>

/** Un alta como se ve mientras no llega a la base: la fila, con lo que la base pondría sola. */
export function itemFromInsert(op: Extract<PendingOp, { type: 'insert' }>): Item {
  return {
    ...ITEM_DEFAULTS,
    ...op.row,
    id: op.itemId,
    user_id: op.userId,
    created_at: op.row.created_at,
    updated_at: op.row.created_at,
  } as Item
}

/** El alta lista para armar la cola: la fila con su `created_at` fijo. */
export function newInsertOp(itemId: string, userId: string, row: NewItemRow, now = new Date().toISOString()): PendingOp {
  return { type: 'insert', itemId, userId, row: { ...row, created_at: row.created_at ?? now }, changes: {} }
}

/** ¿El ítem está en la cola para borrarse (o ir a la papelera)? Entonces no se muestra. */
const isRemoval = (op: PendingOp) => op.type === 'delete' || op.type === 'trash'

export const pendingFor = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId === itemId)

export const withoutItem = (ops: PendingOp[], itemId: string) => ops.filter((o) => o.itemId !== itemId)

/** Ids de las sesiones de un ítem cuyo borrado todavía no llegó a la base. */
export const pendingDeletedActivityIds = (ops: PendingOp[], itemId: string) =>
  ops.flatMap((o) => (o.type === 'deleteActivity' && o.itemId === itemId ? [o.activityId] : []))

/** Las actividades de un ítem que todavía no llegaron a la base. */
export const pendingActivities = (ops: PendingOp[], itemId: string) =>
  ops.flatMap((o) => (o.type === 'activity' && o.itemId === itemId ? [o.activity] : []))

/**
 * Suma un cambio al final de la cola. Una edición se junta con la anterior
 * del mismo ítem si esa también es una edición y es lo último del ítem (y no
 * es `inFlight`, la que se está mandando en este momento).
 */
export function addPendingOp(ops: PendingOp[], op: PendingOp, inFlight?: PendingOp | null): PendingOp[] {
  // Borrar algo que todavía no llegó a la base: no hay nada que borrar allá.
  if (isRemoval(op)) {
    const insert = ops.find((o) => o.type === 'insert' && o.itemId === op.itemId)
    if (insert && insert !== inFlight) {
      return withoutItem(ops, op.itemId)
    }
  }
  if (op.type === 'update') {
    for (let i = ops.length - 1; i >= 0; i--) {
      const prev = ops[i]
      if (prev.itemId !== op.itemId) continue
      if (prev.type === 'update' && prev !== inFlight) {
        const merged: PendingOp = { ...prev, changes: { ...prev.changes, ...op.changes } }
        return [...ops.slice(0, i), merged, ...ops.slice(i + 1)]
      }
      // Editar un alta que todavía no salió: la fila nueva ya lleva el cambio.
      if (prev.type === 'insert' && prev !== inFlight) {
        const merged: PendingOp = { ...prev, row: { ...prev.row, ...op.changes } }
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
    if (op.itemId !== item.id) continue
    if (isRemoval(op) || op.type === 'insert') continue
    out = { ...out, ...op.changes } as Item
    if (op.type === 'deleteActivity' && op.minutes) {
      out = { ...out, time_spent_minutes: Math.max(0, out.time_spent_minutes - op.minutes) }
    }
    if (op.type === 'activity' && op.activity.duration_minutes) {
      // En la base el tiempo lo suma un trigger al guardar la actividad.
      out = { ...out, time_spent_minutes: out.time_spent_minutes + op.activity.duration_minutes }
    }
  }
  return out
}

/** Lo que trae la base, con los cambios que todavía no llegaron encima. */
export function overlayPending(items: Item[], ops: PendingOp[]): Item[] {
  if (ops.length === 0) return items
  const ids = new Set(ops.map((o) => o.itemId))
  const removed = new Set(ops.filter(isRemoval).map((o) => o.itemId))
  const shown = items.filter((i) => !removed.has(i.id)).map((i) => (ids.has(i.id) ? applyPendingOps(i, ops) : i))
  // Los títulos agregados sin conexión que la base todavía no tiene van arriba, los más nuevos primero.
  const known = new Set(items.map((i) => i.id))
  const added = ops
    .flatMap((o) => (o.type === 'insert' && !known.has(o.itemId) && !removed.has(o.itemId) ? [o] : []))
    .map((o) => applyPendingOps(itemFromInsert(o), ops))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return [...added, ...shown]
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
  if (typeof op.itemId !== 'string' || typeof op.changes !== 'object' || op.changes == null) return false
  if (op.type === 'update' || op.type === 'delete') return true
  if (op.type === 'trash') return typeof op.deletedAt === 'string'
  if (op.type === 'deleteActivity') return typeof op.activityId === 'string' && typeof op.minutes === 'number'
  if (op.type === 'insert') {
    const row = op.row as Record<string, unknown> | undefined
    return typeof op.userId === 'string' && typeof row?.title === 'string' && typeof row.created_at === 'string'
  }
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

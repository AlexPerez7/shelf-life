import { describe, expect, it } from 'vitest'
import {
  addPendingOp,
  applyPendingOps,
  isNetworkError,
  overlayPending,
  pendingActivities,
  newItem,
  pendingFor,
  pendingTrash,
  withoutItem,
  type PendingOp,
} from './pendingChanges'
import { makeItem } from '../test/factories'
import type { ItemWrite } from '../types/item'

const update = (itemId: string, changes: ItemWrite): PendingOp => ({ type: 'update', itemId, changes })
const activity = (itemId: string, id: string, minutes: number | null, changes: ItemWrite = {}): PendingOp => ({
  type: 'activity',
  itemId,
  activity: { id, duration_minutes: minutes, progress_delta: 1, occurred_at: '2026-10-10T20:00:00Z' },
  changes,
})

describe('addPendingOp', () => {
  it('junta dos ediciones seguidas del mismo ítem, la segunda pisa lo que repite', () => {
    const ops = addPendingOp([update('a', { rating: 7, notes: 'x' })], update('a', { rating: 9 }))
    expect(ops).toEqual([update('a', { rating: 9, notes: 'x' })])
  })

  it('junta aunque en el medio haya cambios de otros ítems', () => {
    const ops = addPendingOp([update('a', { rating: 7 }), update('b', { rating: 1 })], update('a', { notes: 'y' }))
    expect(ops).toEqual([update('a', { rating: 7, notes: 'y' }), update('b', { rating: 1 })])
  })

  it('no junta por encima de una actividad: el orden del ítem se respeta', () => {
    const ops = addPendingOp([update('a', { progress: 1 }), activity('a', 'x1', 24)], update('a', { progress: 3 }))
    expect(ops.map((o) => o.type)).toEqual(['update', 'activity', 'update'])
  })

  it('no junta con la edición que se está mandando', () => {
    const inFlight = update('a', { rating: 7 })
    const ops = addPendingOp([inFlight], update('a', { rating: 9 }), inFlight)
    expect(ops).toHaveLength(2)
  })

  it('las actividades nunca se juntan', () => {
    const ops = addPendingOp([activity('a', 'x1', 24)], activity('a', 'x2', 24))
    expect(ops).toHaveLength(2)
  })
})

describe('aplicar lo pendiente', () => {
  const item = makeItem({ id: 'a', progress: 2, time_spent_minutes: 60, rating: null })
  const other = makeItem({ id: 'b', progress: 5 })
  const ops = [update('a', { rating: 8 }), activity('a', 'x1', 24, { progress: 3 }), activity('a', 'x2', null, { progress: 4 })]

  it('aplica en orden los cambios y suma el tiempo de las actividades', () => {
    expect(applyPendingOps(item, ops)).toMatchObject({ rating: 8, progress: 4, time_spent_minutes: 84 })
  })

  it('overlayPending solo toca los ítems con cambios', () => {
    const [a, b] = overlayPending([item, other], ops)
    expect(a.progress).toBe(4)
    expect(b).toBe(other)
  })

  it('lista las actividades pendientes de un ítem (sesiones hechas sin conexión)', () => {
    expect(pendingActivities([...ops, activity('b', 'y1', 30)], 'a').map((a) => a.id)).toEqual(['x1', 'x2'])
  })

  it('filtra por ítem', () => {
    const mixed = [...ops, update('b', { rating: 1 })]
    expect(pendingFor(mixed, 'b')).toHaveLength(1)
    expect(withoutItem(mixed, 'a')).toEqual([update('b', { rating: 1 })])
  })
})

describe('isNetworkError', () => {
  it('reconoce los errores de red de cada navegador', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' }, true)).toBe(true)
    expect(isNetworkError(new TypeError('Load failed'), true)).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'), true)).toBe(true)
  })

  it('sin conexión, cualquier error cuenta como de red', () => {
    expect(isNetworkError(new Error('lo que sea'), false)).toBe(true)
  })

  it('un rechazo de la base no es de red', () => {
    expect(isNetworkError({ message: 'new row violates row-level security policy', code: '42501' }, true)).toBe(false)
  })
})

const create = (item: ReturnType<typeof makeItem>): PendingOp => ({ type: 'create', itemId: item.id, item })
const trash = (item: ReturnType<typeof makeItem>, trashed = true): PendingOp => ({
  type: 'delete',
  itemId: item.id,
  trash: trashed,
  deletedAt: '2026-10-11T10:00:00Z',
  item,
})

describe('newItem', () => {
  it('completa los valores por defecto de la base y deja lo que se pasa', () => {
    const item = newItem({ media_type: 'book', title: 'Rayuela', status: 'wishlist' }, 'user-1', 'id-1', '2026-10-11T10:00:00Z')
    expect(item).toMatchObject({
      id: 'id-1',
      user_id: 'user-1',
      media_type: 'book',
      title: 'Rayuela',
      status: 'wishlist',
      progress: 0,
      time_spent_minutes: 0,
      genres: [],
      metadata: {},
      is_favorite: false,
      created_at: '2026-10-11T10:00:00Z',
    })
  })

  it('sin estado, empieza como la base: "planned"', () => {
    expect(newItem({ media_type: 'game', title: 'Hades' }, 'u').status).toBe('planned')
  })
})

describe('altas y bajas pendientes', () => {
  const base = makeItem({ id: 'base', created_at: '2026-01-01T00:00:00Z' })
  const fresh = makeItem({ id: 'fresh', created_at: '2026-10-11T09:00:00Z', progress: 0 })

  it('lo agregado sin conexión aparece primero, con sus ediciones encima', () => {
    const out = overlayPending([base], [create(fresh), update('fresh', { progress: 7 })])
    expect(out.map((i) => i.id)).toEqual(['fresh', 'base'])
    expect(out[0].progress).toBe(7)
  })

  it('con varias altas, la más nueva va primero', () => {
    const second = makeItem({ id: 'second' })
    expect(overlayPending([base], [create(fresh), create(second)]).map((i) => i.id)).toEqual(['second', 'fresh', 'base'])
  })

  it('si la base ya tiene el título (se guardó pero la cola no se limpió), no se repite', () => {
    const out = overlayPending([fresh, base], [create(fresh)])
    expect(out.map((i) => i.id)).toEqual(['fresh', 'base'])
  })

  it('lo borrado no se ve, venga de la base o de la cola', () => {
    expect(overlayPending([base], [trash(base)])).toEqual([])
    expect(overlayPending([base], [create(fresh), trash(fresh, false)]).map((i) => i.id)).toEqual(['base'])
  })

  it('applyPendingOps ignora altas y bajas', () => {
    expect(applyPendingOps(base, [create(base), trash(base)])).toBe(base)
  })

  it('encuentra la papelera pendiente de un título, no el borrado definitivo', () => {
    expect(pendingTrash([trash(base)], 'base')?.item).toBe(base)
    expect(pendingTrash([trash(base, false)], 'base')).toBeUndefined()
    expect(pendingTrash([trash(base)], 'otro')).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import {
  addPendingOp,
  applyPendingOps,
  isNetworkError,
  overlayPending,
  pendingFor,
  withoutItem,
  type PendingOp,
} from './pendingChanges'
import { makeItem } from '../test/factories'

const update = (itemId: string, changes: PendingOp['changes']): PendingOp => ({ type: 'update', itemId, changes })
const activity = (itemId: string, id: string, minutes: number | null, changes: PendingOp['changes'] = {}): PendingOp => ({
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

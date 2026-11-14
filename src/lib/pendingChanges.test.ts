import { describe, expect, it } from 'vitest'
import {
  addPendingOp,
  applyPendingOps,
  isNetworkError,
  itemFromInsert,
  newInsertOp,
  overlayPending,
  pendingActivities,
  pendingDeletedActivityIds,
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

describe('altas y borrados sin conexión', () => {
  const insert = (id: string, title = 'Nuevo', createdAt = '2026-11-01T10:00:00Z') =>
    newInsertOp(id, 'user-1', { media_type: 'book', title, created_at: createdAt })
  const trash = (itemId: string): PendingOp => ({ type: 'trash', itemId, deletedAt: '2026-11-02T10:00:00Z', changes: {} })
  const remove = (itemId: string): PendingOp => ({ type: 'delete', itemId, changes: {} })

  it('un alta se ve completa, con lo que la base pondría sola', () => {
    const op = insert('n1', 'Rayuela')
    if (op.type !== 'insert') throw new Error('se esperaba un alta')
    expect(itemFromInsert(op)).toMatchObject({
      id: 'n1',
      user_id: 'user-1',
      title: 'Rayuela',
      status: 'planned',
      genres: [],
      metadata: {},
      progress: 0,
      time_spent_minutes: 0,
      created_at: '2026-11-01T10:00:00Z',
    })
  })

  it('lo agregado sin conexión sigue arriba cuando llega lo de la base, con sus cambios encima', () => {
    const server = makeItem({ id: 's1', created_at: '2026-10-01T00:00:00Z' })
    const ops = [insert('n1', 'A', '2026-11-01T10:00:00Z'), insert('n2', 'B', '2026-11-02T10:00:00Z'), update('n1', { rating: 9 })]
    const shown = overlayPending([server], ops)
    expect(shown.map((i) => i.id)).toEqual(['n2', 'n1', 's1'])
    expect(shown.find((i) => i.id === 'n1')?.rating).toBe(9)
  })

  it('editar un alta que no salió cambia la fila del alta, sin sumar otro cambio', () => {
    const ops = addPendingOp([insert('n1')], update('n1', { rating: 8, status: 'completed' }))
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ type: 'insert', row: { title: 'Nuevo', rating: 8, status: 'completed' } })
  })

  it('un alta que se está mandando no se toca: lo nuevo va detrás', () => {
    const first = insert('n1')
    const ops = addPendingOp([first], update('n1', { rating: 8 }), first)
    expect(ops).toEqual([first, update('n1', { rating: 8 })])
  })

  it('borrar algo que no llegó a la base cancela todo lo suyo, sin tocar lo de otros', () => {
    const base = [insert('n1'), update('n1', { notes: 'x' }), update('b', { rating: 3 })]
    expect(addPendingOp(base, remove('n1'))).toEqual([update('b', { rating: 3 })])
    expect(addPendingOp(base, trash('n1'))).toEqual([update('b', { rating: 3 })])
  })

  it('borrar algo que ya está en la base queda en la cola y el ítem deja de verse', () => {
    const a = makeItem({ id: 'a' })
    const b = makeItem({ id: 'b' })
    const ops = addPendingOp([update('a', { rating: 5 })], trash('a'))
    expect(ops).toHaveLength(2)
    expect(overlayPending([a, b], ops).map((i) => i.id)).toEqual(['b'])
    expect(overlayPending([a, b], [remove('b')]).map((i) => i.id)).toEqual(['a'])
  })
})

describe('borrar una sesión ya guardada', () => {
  const del = (itemId: string, activityId: string, minutes: number): PendingOp => ({
    type: 'deleteActivity',
    itemId,
    activityId,
    minutes,
    changes: {},
  })

  it('el tiempo del ítem baja mientras el borrado espera, sin pasar de cero', () => {
    const game = makeItem({ id: 'g', time_spent_minutes: 90 })
    expect(overlayPending([game], [del('g', 's1', 30)])[0].time_spent_minutes).toBe(60)
    expect(overlayPending([game], [del('g', 's1', 200)])[0].time_spent_minutes).toBe(0)
  })

  it('lista las sesiones borradas de un ítem que esperan en la cola', () => {
    const ops = [del('g', 's1', 30), del('h', 's2', 10), update('g', { rating: 5 })]
    expect(pendingDeletedActivityIds(ops, 'g')).toEqual(['s1'])
  })
})
